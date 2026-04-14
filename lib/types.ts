export interface GitHubCommit {
  sha: string;
  message: string;
  repo: string;
  timestamp: string;
}

export interface GitHubPR {
  title: string;
  status: 'merged' | 'open' | 'closed';
  repo: string;
  url: string;
}

export interface GitHubIssue {
  title: string;
  status: 'open' | 'closed';
  repo: string;
  url: string;
}

export interface GitHubData {
  commits: GitHubCommit[];
  pullRequests: GitHubPR[];
  issues: GitHubIssue[];
}

export interface LarkMeeting {
  title: string;
  startTime: string;
  endTime: string;
  eventId?: string;
}

export interface LarkMinutes {
  meetingTitle: string;
  summary?: string;
  todos?: string[];
  duration?: number;
  url?: string;
  source?: 'vc' | 'minutes';
}

export interface LarkWikiDoc {
  title: string;
  content: string;
  updatedAt: string;
  url?: string;
}

export interface LarkCalendarData {
  meetings: LarkMeeting[];
  minutes: LarkMinutes[];
  wikiDocs: LarkWikiDoc[];
}

export type ReportDataSource =
  | 'github'
  | 'lark-calendar'
  | 'lark-minutes'
  | 'lark-wiki';

export type ReportWarningCode =
  | 'lark-token-expired'
  | 'lark-not-connected'
  | 'source-collection-failed';

export interface ReportWarning {
  source: ReportDataSource;
  code: ReportWarningCode;
  message: string;
  reconnectRequired?: boolean;
}

export type ReportSourceStatusState = 'collected' | 'failed' | 'skipped';

export interface ReportSourceStatus {
  source: ReportDataSource;
  label: string;
  status: ReportSourceStatusState;
  count?: number;
  message: string;
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  github: GitHubData;
  calendar: LarkCalendarData;
  warnings?: ReportWarning[];
  sourceStatuses?: ReportSourceStatus[];
}

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  content: string;
  createdAt: string;
  filePath?: string;
  warnings?: ReportWarning[];
  sourceStatuses?: ReportSourceStatus[];
}
