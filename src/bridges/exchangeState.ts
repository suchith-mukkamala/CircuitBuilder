import {create} from 'zustand';
import type {LogicController} from './logicController';
/** A handoff is a proposal until Robotics explicitly accepts it. */
export const useExchangeState=create<{pendingController:LogicController|null;offer:(controller:LogicController|null)=>void}>(set=>({
  pendingController:null,offer:pendingController=>set({pendingController}),
}));
