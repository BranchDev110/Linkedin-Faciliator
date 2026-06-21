import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type JobSkillsDocument = HydratedDocument<JobSkills>;

@Schema({ collection: 'job_skills' })
export class JobSkills {
  @Prop({ required: true, unique: true, index: true })
  linkedInJobId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  skills!: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  hardSkills!: string[];

  @Prop({ type: [String], default: [] })
  competencies!: string[];

  @Prop({ default: 0 })
  extractionCostUsd!: number;

  @Prop({ required: true })
  createdAt!: string;

  @Prop({ required: true })
  updatedAt!: string;
}

export const JobSkillsSchema = SchemaFactory.createForClass(JobSkills);
