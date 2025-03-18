import {expectTypeOf} from 'expect-type'
import {describe, test, expect, beforeEach, vi as jest} from 'vitest'
import {MongoDBStorage, UmzugStorage} from '../../src'

describe('MongoDBStorage', () => {
  const mockCollection = {
    insertOne: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{migrationName: 'fake'}]),
      }),
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    test('should fail when collection is not set', () => {
      expect(() => new MongoDBStorage({} as any)).toThrowErrorMatchingInlineSnapshot(
        '"MongoDB Connection or Collection required"',
      )
    })

    test('receives collection', () => {
      const storage = new MongoDBStorage({collection: mockCollection})
      expect(storage.collection).toEqual(mockCollection)
    })

    test('type', () => {
      expectTypeOf(MongoDBStorage).toBeConstructibleWith({collection: mockCollection})
      expectTypeOf(MongoDBStorage).toBeConstructibleWith({connection: {}, collectionName: 'test'})

      expectTypeOf(MongoDBStorage).instance.toMatchTypeOf<UmzugStorage>()
      expectTypeOf(MongoDBStorage).instance.toHaveProperty('collection').toBeObject()
    })

    describe('connection (deprecated - a collection instance should be passed in instead)', () => {
      const mockConnection = {collection: jest.fn().mockReturnValue(mockCollection)}

      test('receives connection', () => {
        const storage = new MongoDBStorage({connection: mockConnection})
        expect(storage.connection).toBe(mockConnection)
        expect(storage.collection).toBe(mockCollection)
        expect(mockConnection.collection).toHaveBeenCalledTimes(1)
        expect(mockConnection.collection).toHaveBeenCalledWith('migrations')
      })

      test('receives collectionName', () => {
        const storage = new MongoDBStorage({
          collection: null as any,
          connection: mockConnection,
          collectionName: 'TEST',
        })
        expect(storage.collectionName).toEqual('TEST')
        expect(storage.connection.collection).toHaveBeenCalledWith('TEST')
      })

      test('default for collectionName', () => {
        const storage = new MongoDBStorage({
          collection: null as any,
          connection: mockConnection,
        })
        expect(storage.collectionName).toEqual('migrations')
        expect(storage.connection.collection).toHaveBeenCalledWith('migrations')
      })
    })
  })

  describe('logMigration', () => {
    test('adds entry to storage', async () => {
      const storage = new MongoDBStorage({collection: mockCollection})
      await storage.logMigration({name: 'm1.txt'})
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(1)
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        migrationName: 'm1.txt',
      })
    })
  })

  describe('unlogMigration', () => {
    test('adds entry to storage', async () => {
      const storage = new MongoDBStorage({collection: mockCollection})
      await storage.unlogMigration({name: 'm1.txt'})
      expect(mockCollection.deleteOne).toHaveBeenCalledTimes(1)
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        migrationName: 'm1.txt',
      })
    })
  })

  describe('executed', () => {
    test('returns', async () => {
      const storage = new MongoDBStorage({collection: mockCollection})
      const mockToArray = mockCollection.find().sort().toArray
      mockToArray.mockReturnValue([{migrationName: 'm1.txt'}])
      expect(await storage.executed()).toEqual(['m1.txt'])
    })
  })
})
