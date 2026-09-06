// Shape of the in-memory interview session stored in Redis.
// Key: interview:context:{interviewId}   TTL: interviewDuration + 10 min buffer

export interface InterviewConfig {
  interviewType:   "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  interviewStyle:  "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM";
  difficulty:      "EASY" | "MEDIUM" | "HARD";
  durationMinutes: number;
  maxFollowUps:    number;
  jobRole?:        string;
  jobSkills?:      string[];
}

export interface CandidateIdentity {
  userId:     string;
  experience: string;
}

export interface QuestionState {
  currentIndex:   number;        // 0-based, incremented as questions are served
  totalQuestions: number | null; // null until the AI engine resolves the count
}

// Stub — replaced by real LangGraph thread data in Step 10
export interface AiContext {
  stub:     true;
  threadId: string; // synthetic ID until LangGraph integration
}

export interface InterviewContext {
  interviewId:       string;
  candidateIdentity: CandidateIdentity;
  config:            InterviewConfig;
  questionState:     QuestionState;
  timerStartedAt:    string; // ISO-8601, stamped once on start
  aiContext:         AiContext;
}
