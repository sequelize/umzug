import * as js from '../javascript/2.things.js';
export = js as { up: Function, down?: Function };
// 'as' doesn't really do anything, but it'd be a syntax 
// error if it was being imported as plain JavaScript
