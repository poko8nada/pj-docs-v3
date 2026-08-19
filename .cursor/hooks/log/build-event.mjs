/*
 * FEATURES: H-reporter
 * PURPOSE: Hook 名と stdin フィールドからログイベントを組み立てる (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

/**
 * Hook 名と公式 stdin フィールドに基づいてログイベントを組み立てる。
 * 存在しない値は推測せず省略する。
 */
export function buildLogEvent(input, hookName, handlerLog) {
  const event = { hook: hookName };
  const payload = isRecord(input) ? input : {};

  if (handlerLog) {
    event.handler = handlerLog.handler;
    event.decision = handlerLog.decision;
    if (handlerLog.reason) {
      event.reason = handlerLog.reason;
    }
  }

  addString(event, 'sessionId', firstString(payload.session_id, payload.sessionId));
  addString(event, 'transcriptPath', firstString(payload.transcript_path, payload.transcriptPath));

  switch (hookName) {
    case 'beforeShellExecution':
    case 'afterShellExecution': {
      addString(event, 'command', payload.command);
      addString(event, 'cwd', payload.cwd);
      break;
    }
    case 'preToolUse':
    case 'postToolUse':
    case 'postToolUseFailure': {
      addString(event, 'tool', payload.tool_name);
      addJson(event, 'input', payload.tool_input);
      addString(event, 'id', payload.tool_use_id);
      addString(event, 'cwd', payload.cwd);
      break;
    }
    case 'beforeMCPExecution':
    case 'afterMCPExecution': {
      addString(event, 'tool', payload.tool_name);
      addJson(event, 'input', payload.tool_input);
      addString(event, 'command', payload.command);
      break;
    }
    case 'beforeReadFile':
    case 'afterFileEdit': {
      addString(event, 'file', payload.file_path);
      break;
    }
    default:
      break;
  }

  return event;
}

function addString(event, key, value) {
  if (typeof value === 'string' && value.length > 0) {
    event[key] = value;
  }
}

function addJson(event, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string') {
    try {
      event[key] = JSON.parse(value);
      return;
    } catch {
      event[key] = value;
      return;
    }
  }

  event[key] = value;
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
