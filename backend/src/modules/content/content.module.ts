import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ConceptsController } from './concepts.controller';
import { ConceptsService } from './concepts.service';

@Module({
  controllers: [ContentController, ConceptsController],
  providers: [ContentService, ConceptsService],
  exports: [ContentService],
})
export class ContentModule {}
