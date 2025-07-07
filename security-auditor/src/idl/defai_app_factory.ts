import defaiAppFactoryIdl from './defai_app_factory.json';

export type DefaiAppFactory = typeof defaiAppFactoryIdl;
export const IDL = defaiAppFactoryIdl as DefaiAppFactory;