import layout from '../data/layout.json';
import exhibitData from '../data/exhibits.json';
export const L = layout;
export const EXHIBITS = exhibitData.exhibits;
export const room = id => L.rooms.find(r => r.id === id);
export * from './geometry.js';
