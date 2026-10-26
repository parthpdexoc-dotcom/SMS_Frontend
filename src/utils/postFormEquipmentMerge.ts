import type { RequestEquipmentDto } from '@/services/requestEquipmentService';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import { mergeRequestAndPostEquipmentForClose } from '@/utils/postPositionEquipmentMerge';

/** Row stored on PostEquipment (post-level override). Request-only rows have no postEquipmentID. */
export function isPostOwnedEquipment(item: PostEquipmentDto): boolean {
  return item.postEquipmentID !== null;
}

/**
 * Display list for post form: request equipment plus post overrides by departmentEquipmentID.
 * Post rows replace request rows for the same equipment; dates and quantity come from the winner.
 */
export function mergeRequestAndPostEquipmentForPostForm(
  requestEquipment: RequestEquipmentDto[],
  postEquipment: PostEquipmentDto[],
  postId: string
): PostEquipmentDto[] {
  return mergeRequestAndPostEquipmentForClose(requestEquipment, postEquipment, postId, {
    requestRowPostEquipmentId: 'none',
    invertRequestEquipmentPerPost: true,
  });
}
