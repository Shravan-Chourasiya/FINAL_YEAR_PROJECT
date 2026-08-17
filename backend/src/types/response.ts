export interface StandardResponse {
  statusCode:number,
  message:string,
  data:object|null 
}
export interface SuccessResponse extends StandardResponse{
  success:true
}

export interface ErrorResponse extends StandardResponse{
  success:false,
  error:string|object|string[]
}