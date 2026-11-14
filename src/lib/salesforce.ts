export interface PunchRecord {
  day: string;
  date: string;
  inTime: string;
  outTime?: string;
}

export interface SessionData {
  cookies: string;
  viewState: string;
  viewStateVersion: string;
  viewStateMAC: string;
  userName: string;
  punchStatus: 'in' | 'out' | 'completed';
  buttonLabel: string;
  selectedDate: string;
  totalHours: string;
  todayPunchIn?: string;
  todayPunchOut?: string;
  reportHistory: PunchRecord[];
  success: boolean;
  message?: string;
}

const BASE_URL = 'https://timesheetastrea-dev-ed.develop.my.salesforce-sites.com';

function extractViewState(html: string) {
  const vsMatch = html.match(/id="com\.salesforce\.visualforce\.ViewState"\s+name="com\.salesforce\.visualforce\.ViewState"\s+value="([^"]+)"/);
  const vsvMatch = html.match(/id="com\.salesforce\.visualforce\.ViewStateVersion"\s+name="com\.salesforce\.visualforce\.ViewStateVersion"\s+value="([^"]+)"/);
  const vsmMatch = html.match(/id="com\.salesforce\.visualforce\.ViewStateMAC"\s+name="com\.salesforce\.visualforce\.ViewStateMAC"\s+value="([^"]+)"/);

  return {
    viewState: vsMatch ? vsMatch[1] : '',
    viewStateVersion: vsvMatch ? vsvMatch[1] : '',
    viewStateMAC: vsmMatch ? vsmMatch[1] : ''
  };
}

// Perform fresh login and return the authenticated HTML, cookies, and tokens
async function performLogin(username: string, password: string) {
  const initialRes = await fetch(`${BASE_URL}/Astrea`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });

  const cookies: string[] = [];
  const rawSetCookie = initialRes.headers.getSetCookie ? initialRes.headers.getSetCookie() : [initialRes.headers.get('set-cookie') || ''];
  for (const c of rawSetCookie) {
    if (c) cookies.push(c.split(';')[0]);
  }
  let cookieHeader = cookies.join('; ');

  const initialHtml = await initialRes.text();
  const initialTokens = extractViewState(initialHtml);

  if (!initialTokens.viewState) {
    throw new Error('Could not retrieve Salesforce ViewState token');
  }

  // Submit login form
  const formData = new FormData();
  formData.append('j_id0:form', 'j_id0:form');
  formData.append('j_id0:form:username', username);
  formData.append('j_id0:form:password', password);
  formData.append('j_id0:form:j_id116', 'j_id0:form:j_id116');
  formData.append('com.salesforce.visualforce.ViewState', initialTokens.viewState);
  formData.append('com.salesforce.visualforce.ViewStateVersion', initialTokens.viewStateVersion);
  formData.append('com.salesforce.visualforce.ViewStateMAC', initialTokens.viewStateMAC);

  const loginRes = await fetch(`${BASE_URL}/Astrea`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'Referer': `${BASE_URL}/Astrea`
    },
    body: formData
  });

  const loginSetCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie') || ''];
  for (const c of loginSetCookie) {
    if (c) cookies.push(c.split(';')[0]);
  }
  const fullCookieHeader = Array.from(new Set(cookies)).filter(Boolean).join('; ');

  const loggedInHtml = await loginRes.text();
  const loggedInTokens = extractViewState(loggedInHtml);

  const isFailed = loggedInHtml.includes('Login To Stay Connected');

  return {
    isFailed,
    html: loggedInHtml,
    tokens: loggedInTokens,
    cookieHeader: fullCookieHeader
  };
}

export async function loginAndGetStatus(username: string, password: string): Promise<SessionData> {
  const loginResult = await performLogin(username, password);

  if (loginResult.isFailed) {
    return {
      cookies: loginResult.cookieHeader,
      viewState: '',
      viewStateVersion: '',
      viewStateMAC: '',
      userName: '',
      punchStatus: 'out',
      buttonLabel: 'Login Failed',
      selectedDate: '',
      totalHours: '',
      reportHistory: [],
      success: false,
      message: 'Invalid username or password'
    };
  }

  const { html, tokens, cookieHeader } = loginResult;

  // Extract user info
  const nameMatch = html.match(/id="profilelink"[^>]*>([^<]+)<\/a>/i);
  const userName = nameMatch ? nameMatch[1].trim() : 'User';

  // Fetch Punch-In/Out Report from Salesforce
  const reportFormData = new FormData();
  reportFormData.append('j_id0:form', 'j_id0:form');
  reportFormData.append('j_id0:form:j_id209', 'j_id0:form:j_id209');
  reportFormData.append('com.salesforce.visualforce.ViewState', tokens.viewState);
  reportFormData.append('com.salesforce.visualforce.ViewStateVersion', tokens.viewStateVersion);
  reportFormData.append('com.salesforce.visualforce.ViewStateMAC', tokens.viewStateMAC);

  const reportRes = await fetch(`${BASE_URL}/Astrea`, {
    method: 'POST',
    headers: { 'Cookie': cookieHeader },
    body: reportFormData
  });

  const reportHtml = await reportRes.text();

  // Parse report rows
  const reportHistory: PunchRecord[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(reportHtml)) !== null) {
    const text = trMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = text.split(' ');
    if (parts.length >= 5) {
      const day = parts[0];
      const date = `${parts[1]}/${parts[2]}/${parts[3]}`;
      const inTime = parts[4] || '';
      const outTime = parts[5] || undefined;
      reportHistory.push({ day, date, inTime, outTime });
    }
  }

  // Check today's punch state
  const now = new Date();
  const dayNum = String(now.getDate()).padStart(2, '0');
  const monthNum = String(now.getMonth() + 1).padStart(2, '0');
  const yearNum = String(now.getFullYear());
  const todayDateStr = `${dayNum}/${monthNum}/${yearNum}`;

  const todayRecord = reportHistory.find(r => r.date === todayDateStr || r.date.includes(`${dayNum}/${monthNum}`));

  let punchStatus: 'in' | 'out' | 'completed' = 'out';
  let buttonLabel = 'Punch In';
  let todayPunchIn: string | undefined = undefined;
  let todayPunchOut: string | undefined = undefined;

  if (todayRecord) {
    todayPunchIn = todayRecord.inTime;
    todayPunchOut = todayRecord.outTime;

    if (todayRecord.inTime && todayRecord.outTime) {
      punchStatus = 'completed';
      buttonLabel = 'Shift Completed';
    } else if (todayRecord.inTime && !todayRecord.outTime) {
      punchStatus = 'in';
      buttonLabel = 'Punch Out';
    } else {
      punchStatus = 'out';
      buttonLabel = 'Punch In';
    }
  } else {
    // Fallback: check buttons on page
    const punchOutMatch = html.match(/<input[^>]+value="Punch Out"[^>]*>/i);
    if (punchOutMatch) {
      punchStatus = 'in';
      buttonLabel = 'Punch Out';
    } else {
      punchStatus = 'out';
      buttonLabel = 'Punch In';
    }
  }

  // Extract selected date
  const dateMatch = html.match(/id="j_id0:form:selectedDate">([^<]+)<\/span>/i);
  const selectedDate = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString();

  // Extract total hours
  const totalMatch = html.match(/Total:\s*([0-9]{2}:[0-9]{2})/i);
  const totalHours = totalMatch ? totalMatch[1] : '00:00';

  return {
    cookies: cookieHeader,
    viewState: tokens.viewState,
    viewStateVersion: tokens.viewStateVersion,
    viewStateMAC: tokens.viewStateMAC,
    userName,
    punchStatus,
    buttonLabel,
    selectedDate,
    totalHours,
    todayPunchIn,
    todayPunchOut,
    reportHistory,
    success: true
  };
}

export async function executePunch(
  username: string, 
  password: string, 
  workMode: 'office' | 'home' = 'office'
): Promise<{ success: boolean; newStatus: 'in' | 'out' | 'completed'; message: string; timestamp: string }> {
  // 1. Fresh login with the user's credentials to get a direct, active ViewState
  const loginResult = await performLogin(username, password);

  if (loginResult.isFailed) {
    return {
      success: false,
      newStatus: 'out',
      message: 'Authentication failed. Please check username and password.',
      timestamp: new Date().toLocaleTimeString()
    };
  }

  const { html, tokens, cookieHeader } = loginResult;

  // Check if user has already completed shift today
  if (!html.includes('value="Punch In"') && !html.includes('value="Punch Out"') && !html.includes('j_id0:form:punchin')) {
    // Neither button is present -> likely already punched in & out today
    return {
      success: false,
      newStatus: 'completed',
      message: 'Today\'s shift is already completed for this user. Salesforce permits one attendance cycle per day.',
      timestamp: new Date().toLocaleTimeString()
    };
  }

  // CASE A: User is currently Punched IN -> Perform PUNCH OUT
  const punchOutTag = html.match(/<input\b[^>]*\bvalue=["']Punch Out["'][^>]*>/i);
  if (punchOutTag) {
    const nameMatch = punchOutTag[0].match(/\bname=["']([^"']+)["']/i);
    const punchOutName = nameMatch ? nameMatch[1] : 'j_id0:form:j_id154';

    const formDataOut = new FormData();
    formDataOut.append('j_id0:form', 'j_id0:form');
    formDataOut.append(punchOutName, 'Punch Out');
    formDataOut.append('com.salesforce.visualforce.ViewState', tokens.viewState);
    formDataOut.append('com.salesforce.visualforce.ViewStateVersion', tokens.viewStateVersion);
    formDataOut.append('com.salesforce.visualforce.ViewStateMAC', tokens.viewStateMAC);

    await fetch(`${BASE_URL}/Astrea`, {
      method: 'POST',
      headers: { 'Cookie': cookieHeader },
      body: formDataOut
    });

    return {
      success: true,
      newStatus: 'completed',
      message: 'Successfully Punched Out! Today\'s shift is recorded.',
      timestamp: new Date().toLocaleTimeString()
    };
  }

  // CASE B: User is currently Punched OUT -> Perform PUNCH IN (2-Step Direct Chain)
  // Step 1: Submit punchin with the fresh login ViewState
  const paramsStep1 = new URLSearchParams();
  paramsStep1.append('AJAXREQUEST', '_viewRoot');
  paramsStep1.append('j_id0:form', 'j_id0:form');
  paramsStep1.append('j_id0:form:punchin', 'j_id0:form:punchin');
  paramsStep1.append('com.salesforce.visualforce.ViewState', tokens.viewState);
  paramsStep1.append('com.salesforce.visualforce.ViewStateVersion', tokens.viewStateVersion);
  paramsStep1.append('com.salesforce.visualforce.ViewStateMAC', tokens.viewStateMAC);

  const modalRes = await fetch(`${BASE_URL}/Astrea`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: paramsStep1.toString()
  });

  const modalXml = await modalRes.text();
  const modalTokens = extractViewState(modalXml);

  if (!modalTokens.viewState) {
    return {
      success: false,
      newStatus: 'completed',
      message: 'Could not open punch confirmation. If you already punched in and out today, Salesforce only allows one punch per day.',
      timestamp: new Date().toLocaleTimeString()
    };
  }

  const confirmBtnMatch = modalXml.match(/id="(j_id0:form:j_id[0-9]+)"[^>]*value="Punch In"/i);
  const confirmBtnId = confirmBtnMatch ? confirmBtnMatch[1] : 'j_id0:form:j_id153';

  // Step 2: Confirm with Work Mode (Work From Office or Work From Home)
  const paramsStep2 = new URLSearchParams();
  paramsStep2.append('AJAXREQUEST', '_viewRoot');
  paramsStep2.append('j_id0:form', 'j_id0:form');
  if (workMode === 'home') {
    paramsStep2.append('j_id0:form:wfhCheckbox', 'on');
  } else {
    paramsStep2.append('j_id0:form:wfoCheckbox', 'on');
  }
  paramsStep2.append(confirmBtnId, confirmBtnId);
  paramsStep2.append('com.salesforce.visualforce.ViewState', modalTokens.viewState);
  paramsStep2.append('com.salesforce.visualforce.ViewStateVersion', modalTokens.viewStateVersion);
  paramsStep2.append('com.salesforce.visualforce.ViewStateMAC', modalTokens.viewStateMAC);

  await fetch(`${BASE_URL}/Astrea`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: paramsStep2.toString()
  });

  return {
    success: true,
    newStatus: 'in',
    message: `Successfully Punched In (${workMode === 'home' ? 'Work From Home' : 'Work From Office'})!`,
    timestamp: new Date().toLocaleTimeString()
  };
}
