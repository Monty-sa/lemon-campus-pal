export interface AdminDashboardData {
  ownerSession: {
    email: string;
    sub: string;
    name?: string;
    picture?: string;
    iat?: number;
    exp?: number;
  };
  overview: {
    siteStatus: string;
    uptimeRatio: string;
    sourceHealth: string;
    lastPublishedAt: string;
    activeSnapshotVersion: string;
    maleCounts: { courses: number; sections: number };
    femaleCounts: { courses: number; sections: number };
    unresolvedErrorsCount: number | string;
  };
  errors: {
    sentryConfigured: boolean;
    apiConnected: boolean;
    statusMessage: string;
    issues: Array<{
      id: string;
      title: string;
      culprit?: string;
      level: string;
      count: number;
      userCount: number;
      permalink: string;
    }>;
  };
  kfuRefresh: {
    refreshSource: string;
    lastAttemptedCheck: string;
    lastSuccessfulMale?: string;
    lastSuccessfulFemale?: string;
    failureReason: string | null;
    heartbeatStatus: string;
    workerNotice: string;
    sectionChangesMale?: Array<{
      crn: string;
      courseCode: string;
      changeType: string;
      summary: string;
      detectedAt: string;
    }>;
    sectionChangesFemale?: Array<{
      crn: string;
      courseCode: string;
      changeType: string;
      summary: string;
      detectedAt: string;
    }>;
  };
  performance: {
    coreWebVitalsTargets: {
      lcp: string;
      inp: string;
      cls: string;
    };
    monitoring: {
      uptimeRobot: string;
      newRelic: string;
      logRocket: string;
    };
  };
  security: {
    googleAuthVerified: boolean;
    allowedRedirectOrigin: string;
    cookieSettings: string;
    isOwnerSubsConfigured: boolean;
    ownerEmailsCount: number;
  };
  systemInfo: {
    nodeVersion: string;
    environment: string;
    deployId: string;
    commitSha: string;
    timestamp: string;
  };
}
