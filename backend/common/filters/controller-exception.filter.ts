import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ControllerExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    let errorMessage: string;

    if (exception.response && exception.response.message) {
      errorMessage = exception.response.message;
    } else {
      errorMessage = exception.message;
    }

    response.status(HttpStatus.OK).json({
      success: false,
      error: errorMessage,
    });

    console.log(exception);
  }
}
