/// <reference types="vite/client" />

type GoogleAccount={email:string;label:string;primary:boolean};
type GoogleStatus={configured:boolean;connected:boolean;email?:string;primaryEmail?:string;accounts:GoogleAccount[]};
type CalendarAttendee={email?:string;displayName?:string;responseStatus?:string;self?:boolean};
type DashboardEvent={id?:string;title:string;start?:string;end?:string;location?:string;description?:string;link?:string;status?:string;organizer?:string;attendees?:CalendarAttendee[]};
type GoogleDashboard={events:DashboardEvent[];conflicts:{first:{title:string};second:{title:string}}[];messages:{id?:string;subject:string;from:string;date:string}[];unreadEstimate:number};
type MediaStatus={active:boolean;title?:string;artist?:string;album?:string;source?:string;playing?:boolean;positionSeconds?:number;durationSeconds?:number};
type CompanionTask={id:string;title:string;details?:string;status:'inbox'|'next'|'waiting'|'done';priority:'low'|'normal'|'high'|'urgent';dueAt?:string;source:string;createdAt:string;updatedAt:string};
type ModelProvider='auto'|'openai'|'gemini'|'ollama';
type CompanionSettings={autonomyMode:'Suggest'|'Confirm'|'Trusted';startAtLogin:boolean;morningBriefingHour:number;eveningReviewHour:number;globalShortcut:string;modelProvider:ModelProvider;openAIModel?:string;geminiModel?:string;screenAwarenessEnabled:boolean};
type ToolAction={tool:string;args:any;description?:string};
type ChatGPTModel={slug:string;displayName:string};
type OpenAIStatus={connected:boolean;sharing:boolean;email?:string;name?:string;models:ChatGPTModel[];error?:string};
type GeminiStatus={configured:boolean;model:string;models:{id:string;name:string}[]};

interface Window { companion: {
  setExpanded(value:boolean):Promise<void>; onExpanded(listener:(value:boolean)=>void):void; onVoiceToggle(listener:()=>void):void; voiceTranscribe(locale?:string):Promise<string>; voiceCancel():Promise<boolean>; close():Promise<void>;
  ollamaStatus():Promise<{connected:boolean;models:string[]}>;
  openAIStatus():Promise<OpenAIStatus>;openAIConnect():Promise<OpenAIStatus>;openAIDisconnect():Promise<OpenAIStatus>;openAIModels():Promise<ChatGPTModel[]>;geminiStatus():Promise<GeminiStatus>;geminiConfigure(apiKey:string):Promise<GeminiStatus>;geminiDisconnect():Promise<GeminiStatus>;screenAnalyze(prompt?:string):Promise<{text:string;model:string;provider?:string}>;
  chat(messages:{role:string;content:string}[],accountEmail?:string,autonomyMode?:string):Promise<{text:string;model:string;pendingAction?:ToolAction;toolResult?:any;agentRun?:boolean;sources?:string[];steps?:number}>;
  executeAction(action:ToolAction,accountEmail?:string):Promise<any>;
  googleStatus():Promise<GoogleStatus>;googleConfigure(clientId:string,clientSecret:string):Promise<GoogleStatus>;googleConnect(email?:string,makePrimary?:boolean):Promise<{connected:true}>;googleSetPrimary(email:string):Promise<GoogleStatus>;googleDisconnect(email?:string):Promise<boolean>;googleDashboard(email?:string):Promise<GoogleDashboard>;googleImportantSummary(email?:string):Promise<{text:string;count:number;model:string}>;googleCreateEvent(email:string|undefined,event:any):Promise<any>;googleUpdateEvent(email:string|undefined,eventId:string,changes:any):Promise<any>;googleDeleteEvent(email:string|undefined,eventId:string):Promise<any>;googleRespondEvent(email:string|undefined,eventId:string,responseStatus:'accepted'|'declined'|'tentative'):Promise<any>;googleCreateDraft(email:string|undefined,message:any):Promise<{id:string}>;googleSendDraft(email:string|undefined,draftId:string):Promise<any>;
  tasksList(includeDone?:boolean):Promise<CompanionTask[]>;tasksCreate(task:Partial<CompanionTask>&{title:string}):Promise<CompanionTask>;tasksUpdate(id:string,patch:Partial<CompanionTask>):Promise<CompanionTask>;
  memoryList():Promise<any[]>;memoryAdd(input:any):Promise<any>;memoryForget(id:string):Promise<void>;memorySearch(query:string):Promise<any[]>;
  settingsGet():Promise<CompanionSettings>;settingsUpdate(patch:Partial<CompanionSettings>):Promise<CompanionSettings>;
  generateBriefing():Promise<string>;onBriefing(listener:(briefing:string)=>void):void;agentCancel():Promise<boolean>;onAgentProgress(listener:(progress:{status:string;step:number}|null)=>void):void;
  mediaGet():Promise<MediaStatus>;mediaCommand(command:'play_pause'|'next'|'previous'|'stop'|'volume_up'|'volume_down'|'mute'):Promise<any>;onMediaChanged(listener:(media:MediaStatus)=>void):void;
  openUrl(url:string):Promise<void>;openPath(target:string):Promise<string>;pickTranscript():Promise<{name:string;summary:string;tasksCreated?:number}|null>;
} }
