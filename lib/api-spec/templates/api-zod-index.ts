import {
  ListCareEntryTombstones200ResponseItem,
  ListHouseholdAuditEvents200Response,
  ListHouseholdInvitations200Response,
  ListHouseholdSharingCleanup200Response,
} from "./generated/api.ts";
import type {
  CareEntryTombstone as CareEntryTombstoneModel,
  HouseholdAuditEvent as HouseholdAuditEventModel,
} from "./generated/types/index.ts";

export * from "./generated/api.ts";

// Orval's status-specific mode inlines component schemas into response
// validators. Recover the established component-level runtime validators from
// those canonical generated response shapes instead of duplicating schemas.
export const CareEntryTombstone = ListCareEntryTombstones200ResponseItem;
export type CareEntryTombstone = CareEntryTombstoneModel;
export const HouseholdAuditEvent =
  ListHouseholdAuditEvents200Response.shape.events.element;
export type HouseholdAuditEvent = HouseholdAuditEventModel;
export const HouseholdAuditEventListFilters =
  ListHouseholdAuditEvents200Response.shape.filters;
export const HouseholdInvitation =
  ListHouseholdInvitations200Response.shape.invitations.element;
export const HouseholdInvitationLifecycleState =
  HouseholdInvitation.shape.lifecycleState;
export const HouseholdInvitationListFilters =
  ListHouseholdInvitations200Response.shape.filters;
export const HouseholdSharingCleanupCandidate =
  ListHouseholdSharingCleanup200Response.shape.candidates.element;
export const HouseholdSharingCleanupFilters =
  ListHouseholdSharingCleanup200Response.shape.filters;
export const HouseholdSharingCleanupKind =
  HouseholdSharingCleanupCandidate.shape.kind;
export const HouseholdSharingCleanupRecommendedAction =
  HouseholdSharingCleanupCandidate.shape.recommendedAction;

// Orval gives operation validators status-specific names. Keep the deliberately
// curated, status-agnostic server surface stable without star-exporting model
// types whose names overlap these runtime validators.
export {
  ActivateHouseholdAccessPassBody as AccessPassActivationBody,
  ActivateHouseholdAccessPass200Response as ActivateHouseholdAccessPassResponse,
  ActivateHouseholdAccessPass200Response as HouseholdAccessPassMutationResponse,
  ActivateHousehold200Response as ActivateHouseholdResponse,
  AskCareHelper200Response as AskCareHelperResponse,
  CreateAvatarEmotions200Response as CreateAvatarEmotionsResponse,
  CreateCareEntry200Response as CreateCareEntryResponse,
  CreateHouseholdInvitation201Response as CreateHouseholdInvitationResponse,
  CreateHouseholdInvitation201Response as HouseholdInvitationMutationResponse,
  CreateWoofguideEvents200Response as CreateWoofguideEventsResponse,
  GetCareHelperStatus200Response as GetCareHelperStatusResponse,
  GetCareState200Response as GetCareStateResponse,
  GetMe200Response as GetMeResponse,
  GetWoofguideEventsStatus200Response as GetWoofguideEventsStatusResponse,
  HealthCheck200Response as HealthCheckResponse,
  JoinHousehold200Response as HouseholdJoinResponse,
  JoinHousehold200Response as JoinHouseholdResponse,
  ListCareEntries200Response as ListCareEntriesResponse,
  ListCareEntries200ResponseItem as ListCareEntriesResponseItem,
  ListCareEntryTombstones200Response as ListCareEntryTombstonesResponse,
  ListHouseholdAuditEvents200Response as HouseholdAuditEventListResponse,
  ListHouseholdAuditEvents200Response as ListHouseholdAuditEventsResponse,
  ListHouseholdInvitations200Response as HouseholdInvitationListResponse,
  ListHouseholdInvitations200Response as ListHouseholdInvitationsResponse,
  ListHouseholdSharingCleanup200Response as HouseholdSharingCleanupResponse,
  ListHouseholdSharingCleanup200Response as ListHouseholdSharingCleanupResponse,
  ListMyHouseholdMemberships200Response as ListMyHouseholdMembershipsResponse,
  PutCareState200Response as PutCareStateResponse,
  RevokeHouseholdAccessPassBody as AccessPassRevocationBody,
  RevokeHouseholdAccessPass200Response as RevokeHouseholdAccessPassResponse,
  RevokeHouseholdInvitation200Response as RevokeHouseholdInvitationResponse,
  RevokeHouseholdMember200Response as RevokeHouseholdMemberResponse,
  StylizeAvatar200Response as StylizeAvatarResponse,
  UpdateCareEntry200Response as UpdateCareEntryResponse,
  UpdateHouseholdMember200Response as HouseholdMemberMutationResponse,
  UpdateHouseholdMember200Response as UpdateHouseholdMemberResponse,
  UpdateHousehold200Response as UpdateHouseholdResponse,
  UpdateMe200Response as UpdateMeResponse,
} from "./generated/api.ts";

export type {
  AccessPassActivationInput,
  AccessPassActivationInputRole,
  AccessPassRevocationInput,
  ApiError,
  AvatarEmotionImage,
  AvatarEmotionsInput,
  AvatarEmotionsResponse,
  AvatarEmotionsResponseErrors,
  AvatarEmotionsResponseImages,
  AvatarStylizeInput,
  AvatarStylizeResponse,
  CareEntry,
  CareEntryConflict,
  CareEntryDetails,
  CareEntryInput,
  CareEntryInputDetails,
  CareEntryUpdate,
  CareEntryUpdateClientSyncProtocol,
  CareEntryUpdateDetails,
  CareHelperAnswer,
  CareHelperError,
  CareHelperInput,
  CareHelperInputContext,
  CareHelperStatus,
  CareStateEnvelope,
  CareStateEnvelopeDoc,
  CareStateInput,
  CareStateInputDoc,
  ExpectedHouseholdIdParameter,
  ExpectedHouseholdMismatchResponse,
  ExpectedHouseholdRequiredResponse,
  HealthStatus,
  Household,
  HouseholdAccessPass,
  HouseholdAccessPassRole,
  HouseholdAccessPassStatus,
  HouseholdActivationInput,
  HouseholdAuditEventAction,
  HouseholdAuditEventLifecycleState,
  HouseholdAuditEventListFiltersAction,
  HouseholdAuditEventListFiltersLifecycleState,
  HouseholdAuditEventStorage,
  HouseholdInvitationCreateInput,
  HouseholdInvitationRevokeInput,
  HouseholdInvitationStorage,
  HouseholdMemberRole,
  HouseholdMemberUpdate,
  HouseholdMemberUpdateRole,
  HouseholdUpdate,
  JoinHouseholdInput,
  ListCareEntriesParams,
  ListCareEntryTombstonesParams,
  ListHouseholdAuditEventsAction,
  ListHouseholdAuditEventsLifecycleState,
  ListHouseholdAuditEventsParams,
  ListHouseholdInvitationsParams,
  ListHouseholdSharingCleanupParams,
  Me,
  Member,
  MeUpdate,
  MyHouseholdMembership,
  MyHouseholdMembershipList,
  MyHouseholdMembershipRole,
  User,
  WoofguideEvent,
  WoofguideEventsInput,
  WoofguideEventsProfile,
  WoofguideEventsResponse,
  WoofguideEventsStatus,
  HouseholdAccessPassMutationResponse as HouseholdAccessPassMutationResponseType,
  HouseholdAuditEventAction as HouseholdAuditAction,
  HouseholdAuditEventLifecycleState as HouseholdAuditLifecycleState,
  HouseholdAuditEventListResponse as HouseholdAuditEventListResponseType,
  HouseholdInvitation as HouseholdInvitationType,
  HouseholdInvitationLifecycleState as HouseholdInvitationLifecycleStateType,
  HouseholdInvitationListFilters as HouseholdInvitationListFiltersType,
  HouseholdInvitationListResponse as HouseholdInvitationListResponseType,
  HouseholdInvitationMutationResponse as HouseholdInvitationMutationResponseType,
  HouseholdJoinResponse as HouseholdJoinResponseType,
  HouseholdMemberMutationResponse as HouseholdMemberMutationResponseType,
  HouseholdSharingCleanupCandidate as HouseholdSharingCleanupCandidateType,
  HouseholdSharingCleanupFilters as HouseholdSharingCleanupFiltersType,
  HouseholdSharingCleanupKind as HouseholdSharingCleanupKindType,
  HouseholdSharingCleanupRecommendedAction as HouseholdSharingCleanupRecommendedActionType,
  HouseholdSharingCleanupResponse as HouseholdSharingCleanupResponseType,
} from "./generated/types/index.ts";
