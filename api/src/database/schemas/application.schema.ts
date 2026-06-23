import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ApplicationDocument = HydratedDocument<Application>;

@Schema({ _id: false })
export class ApplicationCompanyBullets {
  @Prop({ required: true })
  company!: string;

  @Prop({ default: '' })
  bullets!: string;
}

@Schema({ collection: 'applications', strict: false })
export class Application {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  profileId!: string;

  @Prop({ default: '', index: true })
  jobId!: string;

  @Prop({ default: '', index: true })
  linkedInJobId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  skills?: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  hardSkills!: string[];

  @Prop({ type: [String], default: [] })
  competencies!: string[];

  @Prop({ type: [ApplicationCompanyBullets], default: [] })
  companyBullets!: ApplicationCompanyBullets[];

  @Prop({
    required: true,
    enum: ['recorded', 'applied', 'extracted', 'resume_generated'],
    default: 'recorded',
  })
  status!: 'recorded' | 'applied' | 'extracted' | 'resume_generated';

  @Prop({ default: '' })
  resumeUrl!: string;

  @Prop({ default: 0 })
  aiCostUsd!: number;

  @Prop({ type: Object, default: {} })
  aiCostBreakdown!: Record<string, number>;

  @Prop({ required: true })
  createdAt!: string;

  @Prop({ default: '' })
  appliedAt!: string;

  @Prop({ required: true })
  updatedAt!: string;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);
ApplicationSchema.index({ userId: 1, createdAt: -1 });
ApplicationSchema.index({ userId: 1, linkedInJobId: 1 });
ApplicationSchema.index({ userId: 1, profileId: 1, linkedInJobId: 1 });
