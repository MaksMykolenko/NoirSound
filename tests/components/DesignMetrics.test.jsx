import React from 'react';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import i18n from '../../src/i18n';
import SoundIdentityCard from '../../src/components/profile/SoundIdentityCard';
import DiscoverRankedList from '../../src/components/discover/DiscoverRankedList';
import ContextMenuProvider from '../../src/components/context-menu/ContextMenuProvider';

beforeEach(async()=>{await i18n.changeLanguage('en');});
afterEach(cleanup);
describe('archive design uses measured data',()=>{
 it('never invents top-artist plays from followed artists',()=>{
  render(<MemoryRouter><SoundIdentityCard stats={{tracksPlayed:0,uniqueArtists:0}} followedArtists={[{id:'followed-only',name:'Followed only'}]} /></MemoryRouter>);
  expect(screen.queryByText('Followed only')).not.toBeInTheDocument();
  expect(screen.queryByText('150')).not.toBeInTheDocument();
  expect(screen.getByText('Not enough listening data yet')).toBeInTheDocument();
 });
 it('shows API playCount values and supports an expanded genre breakdown',()=>{
  render(<MemoryRouter><SoundIdentityCard stats={{tracksPlayed:10,uniqueArtists:1,topArtists:[{id:'measured',name:'Measured Artist',playCount:7}],topGenres:[{genre:'house',percent:70},{genre:'ambient',percent:30},{genre:'trap',percent:0},{genre:'lofi',percent:0}]}} /></MemoryRouter>);
  const artistRow=screen.getByRole('link',{name:'Measured Artist'}).closest('.justify-between');
  expect(within(artistRow).getByText('7')).toBeInTheDocument();
  expect(screen.queryByText('Lo-fi')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Expanded'}));
  expect(screen.getByRole('button',{name:'Expanded'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByText('Lo-fi')).toBeInTheDocument();
 });
 it('keeps zero plays as zero and disables unstreamable ranked tracks',()=>{
  render(<MemoryRouter><ContextMenuProvider><DiscoverRankedList tracks={[{id:'unavailable',title:'Unavailable release',artistId:'artist',artistName:'Artist',isStreamable:false,plays:0,duration:120}]} /></ContextMenuProvider></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Audio unavailable'})).toBeDisabled();
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'More actions for Unavailable release'})).toBeInTheDocument();
 });
});
