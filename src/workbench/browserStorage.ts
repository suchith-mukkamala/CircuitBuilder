import type {StateStorage} from 'zustand/middleware';
/** Keep editing available when browser storage is blocked or full. SaveIndicator verifies the copy. */
export const browserStorage:StateStorage={
  getItem:key=>{try{return localStorage.getItem(key);}catch{return null;}},
  setItem:(key,value)=>{try{localStorage.setItem(key,value);}catch{/* The working document remains in memory. */}},
  removeItem:key=>{try{localStorage.removeItem(key);}catch{/* Storage is optional for editing. */}},
};
