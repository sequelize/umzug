import Bluebird = require('bluebird');

export function TODO_BLUEBIRD(f): Promise<any> {
	return Bluebird.try(f);
}
