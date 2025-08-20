import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataOutput } from '@common/dtos/output.dto';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({
    summary: '유저 생성 및 조회',
    requestBody: {
      content: {
        'application/json': {
          example: {
            address: '0x1234567890abcdef1234567890abcdef12345678',
          },
        },
      },
    },
  })
  @Post('/')
  @UsePipes(ValidationPipe)
  async createOrGetUser(
    @Body() body: { address: string },
  ): Promise<DataOutput<string>> {
    const user = await this.userService.createOrGetUser(body.address);
    return { success: true, data: user.address };
  }
}
