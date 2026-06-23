import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type JobDocument = HydratedDocument<Job>;

@Schema({ collection: 'jobs' })
export class Job {
  @Prop({ required: true, unique: true, index: true })
  linkedInJobId!: string;

  @Prop({ required: true, default: '' })
  companyName!: string;

  @Prop({ required: true, default: '' })
  jobTitle!: string;

  @Prop({ required: true, default: '' })
  jobDescription!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  skills!: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  hardSkills!: string[];

  @Prop({ type: [String], default: [] })
  competencies!: string[];

  @Prop({ default: '' })
  linkedInJobUrl!: string;

  @Prop({ default: '' })
  realJobUrl!: string;

  @Prop({ default: '' })
  location!: string;

  @Prop({ default: '' })
  companyLogoUrl!: string;

  @Prop({ default: 0 })
  extractionCostUsd!: number;

  @Prop({ required: true })
  createdAt!: string;

  @Prop({ required: true })
  updatedAt!: string;
}

export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ companyName: 1, jobTitle: 1 });
JobSchema.index({ updatedAt: -1 });
