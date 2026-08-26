export interface StandardResponse {
  statusCode:number,
  message:string,
  data: unknown
}
export interface SuccessResponse extends StandardResponse{
  success:true
}

export interface ErrorResponse extends StandardResponse{
  success:false,
  error:string|object|string[]
}