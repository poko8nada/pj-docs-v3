/*
 * FEATURES: H-transformer
 * PURPOSE: セッションログの保存先パス定数を定義する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import { join } from 'node:path';

/** セッションログの保存先（log 書き込み・snapshot 読み取りで共有）。 */
export const LOG_DIRECTORY = join(process.cwd(), '.cursor', '.log');
export const LOG_PATH = join(LOG_DIRECTORY, 'session.jsonl');
export const COUNT_PATH = join(LOG_DIRECTORY, '.session-count');
