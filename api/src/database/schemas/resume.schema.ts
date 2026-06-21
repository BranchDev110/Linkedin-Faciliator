import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResumeDocument = HydratedDocument<Resume>;

@Schema({ collection: 'resumes' })
export class Resume {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  applicationId!: string;

  @Prop({ required: true })
  profileId!: string;

  @Prop({ required: true })
  companyName!: string;

  @Prop({ required: true })
  jobTitle!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ default: 'text' })
  outputFormat!: 'text' | 'docx';

  @Prop({ default: '' })
  summary!: string;

  @Prop({ default: '' })
  skillsSection!: string;

  @Prop({ default: '' })
  filePath!: string;

  @Prop({ default: '' })
  fileName!: string;

  @Prop({ required: true })
  createdAt!: string;
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
ResumeSchema.index({ userId: 1, createdAt: -1 });
ResumeSchema.index({ applicationId: 1 }, { unique: true });
