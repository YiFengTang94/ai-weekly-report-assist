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
}

export interface LarkCalendarData {
  meetings: LarkMeeting[];
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  github: GitHubData;
  calendar: LarkCalendarData;
}

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  content: string;
  createdAt: string;
  filePath?: string;
}
