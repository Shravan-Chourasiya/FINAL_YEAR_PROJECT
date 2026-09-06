import * as z from "zod";
import { TARGET_COMPANIES } from "../../../constants/interview.constants.js";

const DURATION_FLOORS: Record<"BEHAVIORAL" | "TECHNICAL" | "MIXED", number> = {
  BEHAVIORAL: 20,
  TECHNICAL:  30,
  MIXED:      40,
};

export const createInterviewSchema = z.object({
  jobrole: z.string().max(60, "Job role must be at most 60 characters long"),
  experience: z.enum(["fresher", "junior", "mid-level", "senior"], "Experience must be one of: fresher, junior, mid-level, senior").default("fresher"),
  jobSkills: z.array(z.string().max(50)).max(10, "Maximum of 10 skills allowed").optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"], "Difficulty must be one of: EASY, MEDIUM, HARD").default("MEDIUM"),
  interviewStyle: z.enum(["MANGOS", "FAANG", "MAANG", "STARTUP", "CUSTOM"], "Interview style must be one of: MANGOS, FAANG, MAANG, STARTUP, CUSTOM").default("FAANG"),
  interviewType: z.enum(["BEHAVIORAL", "TECHNICAL", "MIXED"], "Interview type must be one of: BEHAVIORAL, TECHNICAL, MIXED").default("MIXED"),
  duration: z.number().int().positive(),
  maxFollowUps: z.number().int().min(0).max(5).default(3),
  isScheduled: z.boolean().default(false),
  scheduledDate: z.coerce.date().optional(),
  targetedCompany: z.enum(TARGET_COMPANIES).optional(),
}).superRefine((data, ctx) => {
  // scheduledDate required and must be in the future when isScheduled is true
  if (data.isScheduled) {
    if (!data.scheduledDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledDate"], message: "scheduledDate is required when isScheduled is true" });
    } else if (data.scheduledDate <= new Date()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledDate"], message: "scheduledDate must be in the future" });
    }
  }

  // duration must meet the minimum floor for the chosen interviewType
  const floor = DURATION_FLOORS[data.interviewType];
  if (data.duration < floor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["duration"], message: `Minimum duration for ${data.interviewType} interviews is ${floor} minutes` });
  }
});
