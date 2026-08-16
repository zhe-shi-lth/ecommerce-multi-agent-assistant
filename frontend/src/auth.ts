const TOKEN_KEY="ea_token"; const IDENTITY_KEY="ea_identity";
export interface StoreOption{id:number;name:string;code:string}
export interface CompanyOption{id:number;name:string;role:string;stores:StoreOption[]}
export interface Identity{role:string;email:string;displayName:string|null;userId:number;companyId:number|null;companyName:string|null;storeId:number|null;storeName:string|null;memberRole:string;permissions:string[];companies:CompanyOption[]}
export interface AuthResult extends Identity{token:string}
export function getToken(){try{return localStorage.getItem(TOKEN_KEY)}catch{return null}}
export function setToken(v:string){try{localStorage.setItem(TOKEN_KEY,v)}catch{/* ignore */}}
export function getIdentity():Identity|null{try{const v=localStorage.getItem(IDENTITY_KEY);return v?JSON.parse(v):null}catch{return null}}
export function setIdentity(v:Identity|AuthResult){try{const {token:_,...identity}=v as AuthResult;localStorage.setItem(IDENTITY_KEY,JSON.stringify(identity))}catch{/* ignore */}}
export function applyAuth(v:AuthResult){setToken(v.token);setIdentity(v);window.dispatchEvent(new Event("tenant-context-changed"))}
export function getRole(){return getIdentity()?.role??null} export function setRole(value:string){const i=getIdentity();if(i)setIdentity({...i,role:value})}
export function clearToken(){try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(IDENTITY_KEY)}catch{/* ignore */}}
export function isAuthed(){return !!getToken()} export function isSuperAdmin(){return getRole()==="SUPER_ADMIN"}
export function canAccessUserMonitoring(){const i=getIdentity();return i?.role==="SUPER_ADMIN"||i?.role==="PLATFORM_ADMIN"||i?.memberRole==="OWNER"}
export function canManageOrganization(){const i=getIdentity();return i?.role==="SUPER_ADMIN"||i?.memberRole==="OWNER"||i?.permissions?.includes("MEMBER_MANAGE")===true}
export function canAccess(permission:string){const i=getIdentity();return i?.role==="SUPER_ADMIN"||i?.memberRole==="OWNER"||i?.permissions?.includes(permission)===true}
export function canManageSettings(){const i=getIdentity();return i?.role==="SUPER_ADMIN"||i?.memberRole==="OWNER"}
