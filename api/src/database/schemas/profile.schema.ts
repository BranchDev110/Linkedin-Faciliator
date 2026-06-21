import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ _id: false })
export class ProfileAddress {
  @Prop({ default: '' })
  city!: string;

  @Prop({ default: '' })
  state!: string;
}

@Schema({ _id: false })
export class ProfileCompany {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  prompt!: string;

  @Prop({ default: 1 })
  bulletCount!: number;
}

export type ProfileDocumentModel = HydratedDocument<Profile>;

@Schema({ collection: 'profiles' })
export class Profile {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  profileName!: string;

  @Prop({ default: '' })
  firstName!: string;

  @Prop({ default: '' })
  lastName!: string;

  @Prop({ default: '' })
  email!: string;

  @Prop({ default: '' })
  phoneNumber!: string;

  @Prop({ default: '' })
  linkedin!: string;

  @Prop({ default: '' })
  generalPrompt!: string;

  @Prop({ type: [ProfileCompany], default: [] })
  companies!: ProfileCompany[];

  @Prop({ default: '' })
  resumeTemplate!: string;

  @Prop({ default: '' })
  resumeTemplateFileName!: string;

  @Prop({ default: '' })
  resumeTemplateFormat!: 'text' | 'docx' | '';

  @Prop({ default: '' })
  resumeTemplateFilePath!: string;

  @Prop({ type: ProfileAddress, default: () => ({ city: '', state: '' }) })
  address!: ProfileAddress;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
