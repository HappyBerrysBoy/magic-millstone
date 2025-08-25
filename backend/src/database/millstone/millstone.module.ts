import { Module } from '@nestjs/common';
import { MillstoneProviders } from '@database/millstone/millstone.providers';

@Module({
  controllers: [],
  providers: [...MillstoneProviders],
  exports: [...MillstoneProviders],
})
export class MillstoneModule {}