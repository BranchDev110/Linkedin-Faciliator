import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ default: '' })
  name!: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ required: true })
  createdAt!: string;

  @Prop({ required: true })
  updatedAt!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
