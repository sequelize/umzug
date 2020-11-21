export interface UmzugLocker {
	lock(id: string): Promise<void>;
	unlock(id: string): Promise<void>;
}
