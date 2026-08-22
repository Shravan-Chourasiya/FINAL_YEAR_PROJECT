export type InterviewType = {
  // Interview Base fields
  id: string;
  userId: string;

  // Interview MetaData fields
  interviewTitle: string;
  interviewDescription?: string | undefined;
  interviewMetaData: {
    jobRole?: string | undefined;
    jobSkills?: string[] | undefined;
    interviewCompanyStyle?: string | undefined;
    interviewType?: string | undefined;
  };
  interviewDuration: number;

  // Interview Status fields
  interviewStatus: string;
  isInterviewScheduled: boolean;
  interviewScheduledDate?: Date|undefined;

  // Interview Outcome fields
  interviewQuestionsGeneratedCount: number | undefined;
  interviewQuestionsAnsweredCount?: number | undefined;
  interviewOutcome: {
    finalScore: number;
    finalVerdict: string;
    questionWiseScore: {
      questionId: string;
      score: number;
      answerId?: string|undefined;
    }[];
    finalFeedBack: string;
    suggestedImprovements?: string | undefined;
    helpfulResources?: string | undefined;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
};
