import type { Model } from '@nozbe/watermelondb';

import Area from './Area';
import CollectionModel from './Collection';
import CollectionItem from './CollectionItem';
import Comment from './Comment';
import Invite from './Invite';
import Note from './Note';
import Photo from './Photo';
import Place from './Place';
import Point from './Point';
import PublicLink from './PublicLink';
import Share from './Share';
import Tag from './Tag';
import Tagging from './Tagging';
import User from './User';

export {
  Area,
  CollectionModel,
  CollectionItem,
  Comment,
  Invite,
  Note,
  Photo,
  Place,
  Point,
  PublicLink,
  Share,
  Tag,
  Tagging,
  User,
};

type ModelClass = new (...args: never[]) => Model;

export const modelClasses: ModelClass[] = [
  User,
  Area,
  Place,
  Point,
  CollectionModel,
  CollectionItem,
  Tag,
  Tagging,
  Note,
  Comment,
  Photo,
  Share,
  Invite,
  PublicLink,
];
