import * as z from "zod";
import { TARGET_COMPANIES } from "../../../constants/interview.constants.js";

export const createInterviewSchema = z.object({
  jobrole: z.string().max(60, "Job role must be at most 60 characters long"),
  experience: z.enum(["fresher","junior", "mid-level", "senior"], "Experience must be one of: fresher, junior, mid-level, senior").default("fresher"),
  interviewStyle: z.enum(["MANGOS", "FAANG", "MAANG", "STARTUP", "CUSTOM"], "Interview style must be one of: MANGOS, FAANG, MAANG, STARTUP, CUSTOM").default("FAANG"),
  interviewType: z.enum(["BEHAVIORAL", "TECHNICAL", "MIXED"], "Interview type must be one of: BEHAVIORAL, TECHNICAL, MIXED").default("MIXED"),
  duration: z.number().positive(),
  isScheduled: z.boolean().default(false)   ,
  scheduledDate: z.date().optional(),
  targetedCompany: z.enum(TARGET_COMPANIES).optional(),
});
