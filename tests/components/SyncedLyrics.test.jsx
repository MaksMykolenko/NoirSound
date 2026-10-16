import '../../src/i18n';
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import LyricsEditor from '../../src/components/lyrics/LyricsEditor';
import SyncedLyricsView from '../../src/components/lyrics/SyncedLyricsView';
import {parseLrc,activeLyricIndex} from '../../src/components/lyrics/timedLyrics';
describe('synchronized lyrics',()=>{
  it('imports authored LRC timing without silently confirming publication rights',async()=>{
    const onChange=vi.fn();
    const {container}=render(<LyricsEditor value={{lyricsText:'',lyricsType:'NONE',lyricsRightsConfirmed:false}} onChange={onChange}/>);
    const file=new File(['[00:01.50]Authored line'],'words.lrc',{type:'text/plain'});
    file.text=async()=>'[00:01.50]Authored line';
    fireEvent.change(container.querySelector('input[type=file]'),{target:{files:[file]}});
    await waitFor(()=>expect(onChange).toHaveBeenCalledWith(expect.objectContaining({lyricsText:'Authored line',lyricsType:'SYNCED',lyricsSynced:[{time:1.5,text:'Authored line'}],lyricsRightsConfirmed:false})));
  });
  it('parses repeated tags and negative offsets, including seeking backwards',()=>{
    const lines=parseLrc('[offset:-500]\n[00:01.500][00:04.00]First\n[00:09]Last');
    expect(lines.map(l=>l.time)).toEqual([1,3.5,8.5]);
    expect(activeLyricIndex(lines,0)).toBe(-1);
    expect(activeLyricIndex(lines,9)).toBe(2);
    expect(activeLyricIndex(lines,2)).toBe(0);
  });
  it('tracks progress and lets a listener seek to a line with a timing offset',()=>{
    const seek=vi.fn(),lines=[{time:10,text:'First line'},{time:20,text:'Next line'}];
    const {rerender}=render(<SyncedLyricsView trackId="fixture" lines={lines} progress={12} onSeek={seek}/>);
    expect(screen.getByText('First line')).toHaveAttribute('aria-current','true');
    fireEvent.click(screen.getByText('Next line'));expect(seek).toHaveBeenCalledWith(20);
    rerender(<SyncedLyricsView trackId="fixture" lines={lines} progress={21} onSeek={seek}/>);
    expect(screen.getByText('Next line')).toHaveAttribute('aria-current','true');
    rerender(<SyncedLyricsView trackId="fixture" lines={lines} progress={0} onSeek={seek}/>);
    expect(screen.getByText('Next line')).not.toHaveAttribute('aria-current');
  });
});
