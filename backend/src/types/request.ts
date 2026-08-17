import type {Request} from "express"

export interface StandardRequest extends Request {
  _id: string;
  userId: string;
  userRole: string;
}
