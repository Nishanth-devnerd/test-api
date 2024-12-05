
type ErrorStatus = 401 | 422 | 403 | 500 | 400 | 303 | 404

export class ErrorModel extends Error {
    code?: string | number
    message: string
    statusCode?: ErrorStatus

    constructor(errData: ErrorModel) {
        super()
        this.code = errData.code;
        this.message = errData.message;
        this.statusCode = errData.statusCode;
        this.name = errData.name
        this.stack = errData.stack
    }
}