import { readFileSync } from 'fs';
import { dirname } from 'path';
import { expect } from 'chai';
import Sequelize from 'sequelize';
import typescript from 'typescript';
import coffeescript from 'coffee-script';
import helper from '../helper';
import Umzug from '../../src';

describe('custom resolver', () => {
    beforeEach(function () {
        helper.clearTmp();
        this.storagePath = __dirname + '/../tmp/storage.sqlite';
        this.sequelize = new Sequelize('database', 'username', 'password', {
            dialect: 'sqlite',
            storage: this.storagePath,
            logging: false
        });

        this.umzug = () => {
            if (!this.path || !this.pattern) {
                throw new Error('path and pattern must be defined');
            }
            return new Umzug({
                migrations: {
                    path: this.path,
                    params: [
                        this.sequelize.getQueryInterface(),
                        this.sequelize.constructor,
                    ],
                    pattern: this.pattern,
                    customResolver: this.customResolver,
                },
                storage: 'sequelize',
                storageOptions: {
                    path: this.storagePath,
                    sequelize: this.sequelize,
                },
            });
        };

        this.verifyTables = async () => {
            const tables = await this.sequelize.query(`select * from sqlite_master where type='table'`);

            expect(tables.sort()).to.deep.equal(['SequelizeMeta', 'thing', 'user']);
        }
    });

    it('resolves javascript files if no custom resolver is defined', async function () {
        this.pattern = /\.js$/;
        this.path = __dirname + '/javascript';
        this.customResolver = undefined;

        await this.umzug().up();

        await this.verifyTables();
    });

    it('can resolve sql files', async function () {
        this.pattern = /\.sql$/;
        this.path = __dirname + '/sql';
        this.customResolver = path => ({
            up: () => this.sequelize.query(readFileSync(path, 'utf8')),
        });

        await this.umzug().up();

        await this.verifyTables();
    });

    it('can resolve typescript files', async function () {
        this.pattern = /\.ts$/;
        this.path = __dirname + '/typescript';
        this.customResolver = path => {
            const typescriptSrc = readFileSync(path, 'utf8');
            const transpiled = typescript.transpileModule(typescriptSrc, {});
            const Module = module.constructor;
            const m = new Module(path, module.parent);
            m.filename = path;
            m.paths = Module._nodeModulePaths(dirname(path));
            m._compile(transpiled.outputText, path);
            return m.exports;
        };

        await this.umzug().up();

        await this.verifyTables();
    });

    it('can resolve coffeescript files', async function () {
        this.pattern = /\.coffee$/;
        this.path = __dirname + '/coffeescript';
        this.customResolver = path => {
            const coffeescriptSrc = readFileSync(path, 'utf8');
            const javascriptSrc = coffeescript.compile(coffeescriptSrc);
            const Module = module.constructor;
            const m = new Module(path, module.parent);
            m.filename = path;
            m.paths = Module._nodeModulePaths(dirname(path));
            m._compile(javascriptSrc, path);
            return m.exports;
        };

        await this.umzug().up();

        await this.verifyTables();
    });
});
