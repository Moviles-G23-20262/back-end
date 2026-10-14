import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateSmartAlertDto } from './create-smart-alert.dto';

// An alert can't be moved to another user.
export class UpdateSmartAlertDto extends PartialType(OmitType(CreateSmartAlertDto, ['userId'] as const)) {}
