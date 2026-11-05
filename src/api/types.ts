/** Narrow subset of the Jellyfin 10.x/12.x OpenAPI schemas, limited to what the UI reads. */

export type ItemType =
  | 'Movie'
  | 'Series'
  | 'Season'
  | 'Episode'
  | 'BoxSet'
  | 'Video'
  | 'MusicVideo'
  | 'Trailer'
  | 'Person'
  | 'Genre'
  | 'CollectionFolder'
  | (string & {});

export interface UserData {
  PlaybackPositionTicks?: number;
  PlayedPercentage?: number | null;
  UnplayedItemCount?: number | null;
  PlayCount?: number;
  IsFavorite?: boolean;
  Likes?: boolean | null;
  Played?: boolean;
}

export interface MediaStream {
  Index: number;
  Type: 'Video' | 'Audio' | 'Subtitle' | 'EmbeddedImage' | 'Data' | 'Lyric';
  Codec?: string | null;
  Language?: string | null;
  Title?: string | null;
  DisplayTitle?: string | null;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsExternal?: boolean;
  IsTextSubtitleStream?: boolean;
  SupportsExternalStream?: boolean;
  DeliveryMethod?: 'Encode' | 'Embed' | 'External' | 'Hls' | 'Drop' | null;
  DeliveryUrl?: string | null;
  IsExternalUrl?: boolean | null;
  Height?: number | null;
  Width?: number | null;
  Channels?: number | null;
}

export interface MediaSource {
  Id: string;
  Name?: string | null;
  Container?: string | null;
  ETag?: string | null;
  RunTimeTicks?: number | null;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  TranscodingUrl?: string | null;
  TranscodingSubProtocol?: string | null;
  DefaultAudioStreamIndex?: number | null;
  DefaultSubtitleStreamIndex?: number | null;
  MediaStreams?: MediaStream[];
}

export interface TrickplayInfo {
  Width: number;
  Height: number;
  TileWidth: number;
  TileHeight: number;
  ThumbnailCount: number;
  Interval: number;
  Bandwidth?: number;
}

export interface Person {
  Id: string;
  Name: string;
  Role?: string | null;
  Type?: string | null;
  PrimaryImageTag?: string | null;
}

export interface NameId {
  Id: string;
  Name: string;
}

export interface Item {
  Id: string;
  Name: string;
  Type: ItemType;
  ServerId?: string;
  OriginalTitle?: string | null;
  Overview?: string | null;
  Taglines?: string[] | null;
  Genres?: string[] | null;
  GenreItems?: NameId[] | null;
  Studios?: NameId[] | null;
  Tags?: string[] | null;
  People?: Person[] | null;
  OfficialRating?: string | null;
  CommunityRating?: number | null;
  CriticRating?: number | null;
  ProductionYear?: number | null;
  PremiereDate?: string | null;
  EndDate?: string | null;
  DateCreated?: string | null;
  DateLastMediaAdded?: string | null;
  Status?: string | null;
  RunTimeTicks?: number | null;
  IsFolder?: boolean;
  IsHD?: boolean | null;
  ChildCount?: number | null;
  RecursiveItemCount?: number | null;
  CollectionType?: string | null;
  LocalTrailerCount?: number | null;
  RemoteTrailers?: { Url?: string | null; Name?: string | null }[] | null;
  MediaSources?: MediaSource[] | null;
  MediaStreams?: MediaStream[] | null;
  Trickplay?: Record<string, Record<string, TrickplayInfo>> | null;
  UserData?: UserData | null;

  ImageTags?: Record<string, string> | null;
  BackdropImageTags?: string[] | null;
  PrimaryImageAspectRatio?: number | null;
  ImageBlurHashes?: Record<string, Record<string, string>> | null;

  // Series/Episode relations
  SeriesId?: string | null;
  SeriesName?: string | null;
  SeasonId?: string | null;
  SeasonName?: string | null;
  IndexNumber?: number | null;
  ParentIndexNumber?: number | null;
  SeriesPrimaryImageTag?: string | null;
  ParentBackdropItemId?: string | null;
  ParentBackdropImageTags?: string[] | null;
  ParentLogoItemId?: string | null;
  ParentLogoImageTag?: string | null;
  ParentThumbItemId?: string | null;
  ParentThumbImageTag?: string | null;
  SeriesThumbImageTag?: string | null;
}

export interface ItemsResult {
  Items: Item[];
  TotalRecordCount: number;
  StartIndex?: number;
}

export interface UserDto {
  Id: string;
  Name: string;
  ServerId?: string;
  PrimaryImageTag?: string | null;
  HasPassword?: boolean;
  HasConfiguredPassword?: boolean;
  Configuration?: {
    AudioLanguagePreference?: string | null;
    SubtitleLanguagePreference?: string | null;
    PlayDefaultAudioTrack?: boolean;
    SubtitleMode?: 'Default' | 'Always' | 'OnlyForced' | 'None' | 'Smart';
    EnableNextEpisodeAutoPlay?: boolean;
  };
  Policy?: { IsAdministrator?: boolean; EnableContentDownloading?: boolean };
}

export interface AuthResult {
  User: UserDto;
  AccessToken: string;
  ServerId: string;
}

export interface PublicSystemInfo {
  ServerName?: string;
  Version?: string;
  ProductName?: string;
  Id?: string;
  StartupWizardCompleted?: boolean;
}

export interface QuickConnectResult {
  Authenticated: boolean;
  Secret: string;
  Code: string;
}

export interface PlaybackInfoResponse {
  MediaSources: MediaSource[];
  PlaySessionId?: string | null;
  ErrorCode?: string | null;
}

export interface RecommendationDto {
  Items: Item[];
  RecommendationType: string;
  BaselineItemName?: string | null;
  CategoryId: string;
}

export interface SearchHint {
  Id?: string;
  ItemId?: string;
  Name: string;
  Type: string;
  MediaType?: string | null;
  ProductionYear?: number | null;
  PrimaryImageTag?: string | null;
  ThumbImageTag?: string | null;
  ThumbImageItemId?: string | null;
  BackdropImageTag?: string | null;
  BackdropImageItemId?: string | null;
  Series?: string | null;
}

export interface MediaSegment {
  Id: string;
  ItemId: string;
  Type: 'Unknown' | 'Commercial' | 'Preview' | 'Recap' | 'Outro' | 'Intro';
  StartTicks: number;
  EndTicks: number;
}

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode';

export interface PlaybackReport {
  ItemId: string;
  MediaSourceId?: string;
  PlaySessionId?: string | null;
  PositionTicks?: number;
  IsPaused?: boolean;
  IsMuted?: boolean;
  VolumeLevel?: number;
  AudioStreamIndex?: number | null;
  SubtitleStreamIndex?: number | null;
  PlayMethod?: PlayMethod;
  CanSeek?: boolean;
  EventName?: string;
}
