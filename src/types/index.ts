type SuccessResponse<T> = {
  success: true
  data: T
}

type ErrorResponse<E> = {
  success: false
  error: E
}

export type ApiResponse<T, E> = SuccessResponse<T> | ErrorResponse<E>
