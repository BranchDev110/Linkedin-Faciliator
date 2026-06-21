import { IsNotEmpty, IsString } from 'class-validator';

// Kept for backwards compatibility during migration; prefer Bearer /auth/sync.
export class VerifyTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
