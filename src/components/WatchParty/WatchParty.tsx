//import './App.css';

import querystring from 'querystring';
import axios from 'axios';
import magnet from 'magnet-uri';
import React from 'react';
import { KeyboardAvoidingView, Dimensions, Text, TextInput, StyleSheet, View, DrawerLayoutAndroid, Button} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import io from 'socket.io-client';
import {
  formatSpeed,
  getMediaType,
  serverPath,
  testAutoplay,
  getAndSaveClientId,
} from '../../utils';
import { Chat } from '../Chat';
import { getDefaultSettings } from '../Settings';
import { Controls } from '../Controls/Controls';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: any;
    YT: any;
  }
}

interface AppProps {
  vanity?: string;
  user?: firebase.User;
}

interface AppState {
  state: 'init' | 'starting' | 'connected';
  currentMedia: string;
  currentSubtitle: string;
  currentMediaPaused: boolean;
  participants: User[];
  rosterUpdateTS: Number;
  chat: ChatMessage[];
  tsMap: NumberDict;
  nameMap: StringDict;
  pictureMap: StringDict;
  myName: string;
  loading: boolean;
  scrollTimestamp: number;
  controlsTimestamp: number;
  watchOptions: SearchResult[];
  isYouTubeReady: boolean;
  isAutoPlayable: boolean;
  connections: number;
  error: string;
  isErrorAuth: boolean;
  settings: Settings;
  nonPlayableMedia: boolean;
  currentTab: string;
  roomLock: string;
  roomId: string;
  errorMessage: string;
  successMessage: string;
  showRightBar: boolean;
  pbStatus: Object;
  }

export default class WatchParty extends React.Component<AppProps, AppState> {
  state: AppState = {
    state: 'starting',
    currentMedia: '',
    currentMediaPaused: false,
    currentSubtitle: '',
    participants: [],
    rosterUpdateTS: Number(new Date()),
    chat: [],
    tsMap: {},
    nameMap: {},
    pictureMap: {},
    myName: '',
    loading: true,
    scrollTimestamp: 0,
    controlsTimestamp: 0,
    watchOptions: [],
    isYouTubeReady: false,
    isAutoPlayable: true,
    connections: 0,
    error: '',
    isErrorAuth: false,
    settings: {},
    nonPlayableMedia: false,
    currentTab: 'chat',
    roomLock: '',
    roomId: '',
    errorMessage: '',
    successMessage: '',
    pbStatus: {},
  };
  socket: SocketIOClient.Socket = null as any;
  watchPartyYTPlayer: any = null;
  ytDebounce = true;
  screenHostPC: PCDict = {};
  screenSharePC?: RTCPeerConnection;
  progressUpdater?: number;
  heartbeat: number | undefined = undefined;
  currentTimeInterval: number | undefined = undefined;
  windowWidth = 0;
  windowHeight = 0;
  videoRef;

  async componentDidMount() {

    // Send heartbeat to the server
    this.heartbeat = setInterval(() => {
      fetch(serverPath + '/ping');
    }, 1 * 60 * 1000);

    //const canAutoplay = await testAutoplay();
    //this.setState({ isAutoPlayable: canAutoplay });
    this.loadSettings();
    //this.loadYouTube();
    this.windowWidth = Dimensions.get('window').width;
    this.windowHeight = Dimensions.get('window').height;
    this.init();
  }

  componentWillUnmount() {
    clearInterval(this.heartbeat);
    clearInterval(this.currentTimeInterval);
    console.log("DISCONNECTED");
    this.socket.disconnect();
  }

  componentDidUpdate(prevProps: AppProps) {
    if (this.props.user && !prevProps.user) {
      this.loadSignInData();
    }
  }

  loadSettings = async () => {
    // Load settings from localstorage and remote
    const customSettingsData = await fetch(serverPath + '/settings');
    const customSettings = await customSettingsData.json();
    let settings = { ...getDefaultSettings(), ...customSettings };
    this.setState({ settings });
  };

  loadSignInData = async () => {
    const user = this.props.user;
    if (user && this.socket) {
      // NOTE: firebase auth doesn't provide the actual first name data that individual providers (G/FB) do
      // It's accessible at the time the user logs in but not afterward
      // If we want accurate surname/given name we'll need to save that somewhere
      const firstName = user.displayName?.split(' ')[0];
      if (firstName) {
        this.updateName(null, { value: firstName });
      }
      this.updateUid(user);
      const token = await user.getIdToken();
    }
  };

  /* loadYouTube = () => { */
  /*   // This code loads the IFrame Player API code asynchronously. */
  /*   const tag = document.createElement('script'); */
  /*   tag.src = 'https://www.youtube.com/iframe_api'; */
  /*   var firstScriptTag = document.getElementsByTagName('script')[0]; */
  /*   firstScriptTag!.parentNode!.insertBefore(tag, firstScriptTag); */

  /*   window.onYouTubeIframeAPIReady = () => { */
  /*     // Note: this fails silently if the element is not available */
  /*     const ytPlayer = new window.YT.Player('leftYt', { */
  /*       events: { */
  /*         onReady: () => { */
  /*           this.watchPartyYTPlayer = ytPlayer; */
  /*           this.setState({ isYouTubeReady: true, loading: false }); */
  /*           // We might have failed to play YT originally, ask for the current video again */
  /*           if (this.isYouTube()) { */
  /*             this.socket.emit('CMD:askHost'); */
  /*           } */
  /*         }, */
  /*         onStateChange: (e: any) => { */
  /*           if ( */
  /*             getMediaType(this.state.currentMedia) === 'youtube' && */
  /*             e.data === window.YT?.PlayerState?.CUED */
  /*           ) { */
  /*             this.setState({ loading: false }); */
  /*           } */
  /*           // console.log(this.ytDebounce, e.data, this.watchPartyYTPlayer?.getVideoUrl()); */
  /*           if ( */
  /*             this.ytDebounce && */
  /*             ((e.data === window.YT?.PlayerState?.PLAYING && */
  /*               this.state.currentMediaPaused) || */
  /*               (e.data === window.YT?.PlayerState?.PAUSED && */
  /*                 !this.state.currentMediaPaused)) */
  /*           ) { */
  /*             this.ytDebounce = false; */
  /*             if (e.data === window.YT?.PlayerState?.PLAYING) { */
  /*               this.socket.emit('CMD:play'); */
  /*               this.doPlay(); */
  /*             } else { */
  /*               this.socket.emit('CMD:pause'); */
  /*               this.doPause(); */
  /*             } */
  /*             window.setTimeout(() => (this.ytDebounce = true), 500); */
  /*           } */
  /*         }, */
  /*       }, */
  /*     }); */
  /*   }; */
  /* }; */

  init = async () => {
    // Load room ID from url
    let roomId = '/default';
    // if a vanity name, resolve the url to a room id
    if (this.props.vanity) {
      try {
        const response = await axios.get(
          serverPath + '/resolveRoom/' + this.props.vanity
        );
        if (response.data.roomId) {
          roomId = response.data.roomId;
        } else {
          throw new Error('failed to resolve room name');
        }
      } catch (e) {
        console.error(e);
        this.setState({ error: "There's no room with this name." });
        return;
      }
    }
    this.setState({ roomId });
    this.join(roomId);
  };

  join = async (roomId: string) => {
    let password = '';
    let shard = '';
    if (/^\d/.test(roomId.slice(1))) {
      // Rooms assigned to shards start with a number
      shard = /^\d+/.exec(roomId.slice(1))?.[0] ?? '';
    }
    const socket = io.connect(serverPath + roomId, {
      transports: ['websocket'],
      query: {
        clientId: getAndSaveClientId(),
        password,
        shard,
      },
      'forceNew': true,
    });
    this.socket = socket;
    socket.on('connect', async () => {
      this.setState({ state: 'connected' });
      this.updateName(null, { value: 'woof' });
      this.loadSignInData();
    });
    socket.on('error', (err: any) => {
      console.error(err);
      if (err === 'Invalid namespace') {
        this.setState({ error: "There's no room with this name." });
      } else if (err === 'not authorized') {
        this.setState({ isErrorAuth: true });
      } else if (err === 'room full') {
        this.setState({ error: 'This room is full.' });
      } else {
        this.setState({ error: 'An error occurred.' });
      }
    });
    socket.on('errorMessage', (err: string) => {
      this.setState({ errorMessage: err });
      setTimeout(() => {
        this.setState({ errorMessage: '' });
      }, 3000);
    });
    socket.on('successMessage', (success: string) => {
      this.setState({ successMessage: success });
      setTimeout(() => {
        this.setState({ successMessage: '' });
      }, 3000);
    });
    socket.on('REC:play', () => {
      this.doPlay();
    });
    socket.on('REC:pause', () => {
      this.doPause();
    });
    socket.on('REC:seek', (data: any) => {
      this.doSeek(data);
    });
    socket.on('REC:subtitle', (data: string) => {
      this.setState(
        { currentSubtitle: serverPath + '/subtitle/' + data },
        () => {
          if (!this.isSubtitled()) {
            this.toggleSubtitle();
          }
        }
      );
    });
    socket.on('REC:host', async (data: HostState) => {
      let currentMedia = data.video || '';
      this.setState(
        {
          currentMedia,
          currentMediaPaused: data.paused,
          currentSubtitle: Boolean(data.subtitle)
            ? serverPath + '/subtitle/' + data.subtitle
            : '',
          loading: Boolean(data.video),
          nonPlayableMedia: false,
        },
        async () => {
          // Stop all players
          await this.videoRef?.unloadAsync();
          await this.watchPartyYTPlayer?.stopVideo();

          if (this.isYouTube() && !this.watchPartyYTPlayer) {
            console.log(
              'YT player not ready, onReady callback will retry when it is'
            );
          } else {
            // Start this video
            this.doSrc(data.video, data.videoTS);
            if (!data.paused) {
              await this.videoRef.setStatusAsync({shouldPlay: true})
              this.doPlay();
            }
            if (data.subtitle) {
              if (!this.isSubtitled()) {
                this.toggleSubtitle();
              }
            }
            // One time, when we're ready to play
            if (this.state.pbStatus.shouldPlay){
              this.setLoadingFalse();
              this.jumpToLeader();
            }
          }
        }
      );
    });
    socket.on('REC:chat', (data: ChatMessage) => {
      this.state.chat.push(data);
      this.setState({
        chat: this.state.chat.slice(-15),
        scrollTimestamp: Number(new Date()),
      });
    });
    socket.on('REC:tsMap', (data: NumberDict) => {
      this.setState({ tsMap: data });
    });
    socket.on('REC:nameMap', (data: StringDict) => {
      this.setState({ nameMap: data });
    });
    socket.on('REC:pictureMap', (data: StringDict) => {
      this.setState({ pictureMap: data });
    });
    socket.on('REC:lock', (data: string) => {
      this.setState({ roomLock: data });
    });
    socket.on('roster', (data: User[]) => {
      this.setState({ participants: data, rosterUpdateTS: Number(new Date()) });
    });
    socket.on('chatinit', (data: any) => {
      this.setState({ chat: data.slice(-15), scrollTimestamp: Number(new Date()) });
    });
    this.currentTimeInterval = setInterval(() => {
      if (this.state.currentMedia) {
        this.socket.emit('CMD:ts', this.getCurrentTime());
      }
    }, 1000);
  };

  isYouTube = () => {
    return getMediaType(this.state.currentMedia) === 'youtube';
  };

  isVideo = () => {
    return getMediaType(this.state.currentMedia) === 'video';
  };

  isHttp = () => {
    return this.state.currentMedia.startsWith('http');
  };

  getCurrentTime = () => {
    if (this.isVideo()) {
      return Math.floor(this.state.pbStatus.positionMillis / 1000);
    }
    if (this.isYouTube()) {
      return this.watchPartyYTPlayer?.getCurrentTime();
    }
  };

  getDuration = () => {
    if (this.isVideo()) {
      return Math.floor(this.state.pbStatus.durationMillis / 1000);
    }
    if (this.isYouTube()) {
      return this.watchPartyYTPlayer?.getDuration();
    }
    return 0;
  };

  isPaused = () => {
    if (this.isVideo()) {
      if (!this.videoRef) return true;
      return (!this.state.pbStatus.isPlaying) || (this.state.pbStatus.positionMillis == this.state.pbStatus.durationMillis);
    }
    if (this.isYouTube()) {
      return (
        this.watchPartyYTPlayer?.getPlayerState() ===
        window.YT?.PlayerState?.PAUSED ||
        this.watchPartyYTPlayer?.getPlayerState() ===
        window.YT?.PlayerState?.ENDED
      );
    }
    return false;
  };

  isMuted = () => {
    if (this.isVideo()) {
      const leftVideo = document.getElementById(
        'leftVideo'
      ) as HTMLMediaElement;
      //if (!leftVideo) return false;
      return leftVideo?.muted;
    }
    if (this.isYouTube()) {
      return this.watchPartyYTPlayer?.isMuted();
    }
    return false;
  };

  isSubtitled = () => {
    if (this.isVideo()) {
      const leftVideo = document.getElementById(
        'leftVideo'
      ) as HTMLMediaElement;
      if (!leftVideo) return false;
      return (
        leftVideo.textTracks[0] && leftVideo.textTracks[0].mode === 'showing'
      );
    }
    if (this.isYouTube()) {
      try {
        const current = this.watchPartyYTPlayer?.getOption('captions', 'track');
        return Boolean(current && current.languageCode);
      } catch (e) {
        console.warn(e);
        return false;
      }
    }
    return false;
  };

  jumpToLeader = () => {
    // Jump to the leader's position
    const maxTS = this.getLeaderTime();
    if (maxTS > 0) {
      console.log('jump to leader at ', maxTS);
      this.doSeek(maxTS);
    }
  };

  doSrc = async (src: string, time: number) => {
    console.log('doSrc', src, time);
    if (this.isVideo()) {
      if (this.videoRef) {
        await this.videoRef.unloadAsync();
        await this.videoRef.loadAsync({uri: src}, {
          progressUpdateIntervalMillis: 1000,
          positionMillis: time * 1000,
          shouldPlay: false
        });
      }
    }
    if (this.isYouTube()) {
      let url = new window.URL(src);
      // Standard link https://www.youtube.com/watch?v=ID
      let videoId = querystring.parse(url.search.substring(1))['v'];
      // Link shortener https://youtu.be/ID
      let altVideoId = src.split('/').slice(-1)[0];
      this.watchPartyYTPlayer?.cueVideoById(videoId || altVideoId, time);
    }
  };

  doPlay = async () => {
    const canAutoplay = this.state.isAutoPlayable || (await testAutoplay());
    this.setState(
      { currentMediaPaused: false, isAutoPlayable: canAutoplay },
      async () => {
        if (this.isVideo()) {
          try {
            if (this.state.pbStatus.positionMillis == this.state.pbStatus.durationMillis)
              this.doSeek(0);
            this.videoRef?.playAsync();
          } catch (e) {
            console.warn(e);
            if (e.name === 'NotSupportedError') {
              this.setState({ loading: false, nonPlayableMedia: true });
            }
          }
        }
        if (this.isYouTube()) {
          console.log('play yt');
          this.watchPartyYTPlayer?.playVideo();
        }
      }
    );
  };

  doPause = () => {
    this.setState({ currentMediaPaused: true }, async () => {
      if (this.isVideo()) {
        this.videoRef.pauseAsync();
      }
      if (this.isYouTube()) {
        console.log('pause');
        this.watchPartyYTPlayer?.pauseVideo();
      }
    });
  };

  doSeek = (time: number) => {
    this.setState({position: time});
    if (this.isPaused())
      this.videoRef.setStatusAsync({shouldPlay: false});
    if (this.isVideo()) {
      this.videoRef.setPositionAsync(time * 1000);
    }
    if (this.isYouTube()) {
      this.watchPartyYTPlayer?.seekTo(time, true);
    }
  };

  togglePlay = () => {
    let shouldPlay = true;
    if (this.isVideo()) {
      shouldPlay = this.isPaused();//!playbackStatus.shouldPlay;//leftVideo.paused || leftVideo.ended;
    } else if (this.isYouTube()) {
      shouldPlay =
        this.watchPartyYTPlayer?.getPlayerState() ===
        window.YT?.PlayerState.PAUSED ||
        this.getCurrentTime() === this.getDuration();
    }
    if (shouldPlay) {
      this.socket.emit('CMD:play');
      this.doPlay();
    } else {
      this.socket.emit('CMD:pause');
      this.doPause();
    }
  };

  onSeek = (time: number) => {
    this.doSeek(time);
    this.socket.emit('CMD:seek', time);
  };

  toggleSubtitle = () => {
    if (this.isYouTube()) {
      const isSubtitled = this.isSubtitled();
      // console.log(isSubtitled);
      if (isSubtitled) {
        // BUG this doesn't actually set the value so subtitles can't be toggled off
        this.watchPartyYTPlayer?.setOption('captions', 'track', {});
      } else {
        this.watchPartyYTPlayer?.setOption('captions', 'reload', true);
        const tracks = this.watchPartyYTPlayer?.getOption(
          'captions',
          'tracklist'
        );
        this.watchPartyYTPlayer?.setOption('captions', 'track', tracks[0]);
      }
    }
  };

  setMedia = (_e: any, data: string) => {
    this.socket.emit('CMD:host', data);
  };

  updateName = (_e: any, data: { value: string }) => {
    this.setState({ myName: data.value });
    this.socket.emit('CMD:name', data.value);
  };

  updatePicture = (url: string) => {
    this.socket.emit('CMD:picture', url);
  };

  updateUid = async (user: firebase.User) => {
    const uid = user.uid;
    const token = await user.getIdToken();
    this.socket.emit('CMD:uid', { uid, token });
  };

  getMediaDisplayName = (input: string) => {
    if (!input) {
      return '';
    }
    // Show the whole URL for youtube
    if (getMediaType(input) === 'youtube') {
      return input;
    }
    if (input.includes('/stream?torrent=magnet')) {
      const search = new URL(input).search;
      const magnetUrl = querystring.parse(search.substring(1))
        .torrent as string;
      const magnetParsed = magnet.decode(magnetUrl);
      return magnetParsed.name;
    }
    // Get the filename out of the URL
    return input;
  };

  getFileName = (input: string) => {
    return input.split('/').slice(-1)[0];
  };

  setLoadingFalse = () => {
    this.setState({ loading: false });
  };

  onManage = async () => {
    const resp = await fetch(serverPath + '/manageSub', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: this.props.user?.uid,
        token: await this.props.user?.getIdToken(),
        return_url: serverPath,
      }),
    });
    const session = await resp.json();
    console.log(session);
    window.location.assign(session.url);
  };

  setRoomLock = async (locked: boolean) => {
    const uid = this.props.user?.uid;
    const token = await this.props.user?.getIdToken();
    this.socket.emit('CMD:lock', { uid, token, locked });
  };

  haveLock = () => {
    if (!this.state.roomLock) {
      return true;
    }
    return this.props.user?.uid === this.state.roomLock;
  };


  getLeaderTime = () => {
    return Math.max(...Object.values(this.state.tsMap));
  };

  render() {
    //const sharer = this.state.participants.find((p) => p.isScreenShare);
    /* const controls = ( */
    /*   <Controls */
    /*     key={this.state.controlsTimestamp} */
    /*     togglePlay={this.togglePlay} */
    /*     onSeek={this.onSeek} */
    /*     fullScreen={this.fullScreen} */
    /*     toggleMute={this.toggleMute} */
    /*     toggleSubtitle={this.toggleSubtitle} */
    /*     jumpToLeader={this.jumpToLeader} */
    /*     paused={this.isPaused()} */
    /*     muted={this.isMuted()} */
    /*     subtitled={this.isSubtitled()} */
    /*     currentTime={this.getCurrentTime()} */
    /*     duration={this.getDuration()} */
    /*     disabled={!this.haveLock()} */
    /*     leaderTime={this.isHttp() ? this.getLeaderTime() : undefined} */
    /*   /> */
    /* ); */
    /* const rightBar = ( */
    /*   <Input */
    /*     inverted */
    /*     fluid */
    /*     label= {'('+this.state.participants.length+')  My name is:'} */
    /*     value={this.state.myName} */
    /*     onChange={this.updateName} */
    /*     style={{ visibility: displayRightContent ? '' : 'hidden' }} */
    /*   /> */
    /* ); */
    {/* <React.Fragment> */}
    {/*   {!this.state.isAutoPlayable && ( */}
    {/*     <Modal inverted basic open> */}
    {/*       <div style={{ display: 'flex', justifyContent: 'center' }}> */}
    {/*         <Button */}
    {/*           primary */}
    {/*           size="large" */}
    {/*           onClick={() => { */}
    {/*             this.setState({ isAutoPlayable: true }); */}
    {/*             this.setMute(false); */}
    {/*           }} */}
    {/*           icon */}
    {/*           labelPosition="left" */}
    {/*         > */}
    {/*           <Icon name="volume up" /> */}
    {/*           Click to unmute */}
    {/*         </Button> */}
    {/*       </div> */}
    {/*     </Modal> */}
    {/*   )} */}
    {/*   {this.state.error && <ErrorModal error={this.state.error} />} */}
    {/*   {this.state.errorMessage && ( */}
    {/*     <Message */}
    {/*       negative */}
    {/*       header="Error" */}
    {/*       content={this.state.errorMessage} */}
    {/*       style={{ */}
    {/*         position: 'fixed', */}
    {/*         bottom: '10px', */}
    {/*         right: '10px', */}
    {/*         zIndex: 1000, */}
    {/*       }} */}
    {/*     ></Message> */}
    {/*   )} */}
    {/*   {this.state.successMessage && ( */}
    {/*     <Message */}
    {/*       positive */}
    {/*       header="Success" */}
    {/*       content={this.state.successMessage} */}
    {/*       style={{ */}
    {/*         position: 'fixed', */}
    {/*         bottom: '10px', */}
    {/*         right: '10px', */}
    {/*         zIndex: 1000, */}
    {/*       }} */}
    {/*     ></Message> */}
    {/*   )} */}
    {/*   { */}
    {/*     <Grid stackable celled="internally"> */}
    {/*       <Grid.Row> */}
    {/*         <Grid.Column */}
    {/*           width={this.state.showRightBar ? 12 : 15} */}
    {/*           className="fullHeightColumn" */}
    {/*         > */}
    {/*           <div */}
    {/*             style={{ */}
    {/*               display: 'flex', */}
    {/*               flexDirection: 'column', */}
    {/*               height: '100%', */}
    {/*             }} */}
    {/*           > */}
    {/*               {false && this.state.currentMedia && ( */}
    {/*                 <Popup */}
    {/*                   content="Upload a .srt subtitle file for this video" */}
    {/*                   trigger={ */}
    {/*                     <Button style={{width: '0',}} */}
    {/*                       fluid */}
    {/*                       color="violet" */}
    {/*                       //className="toolButton" */}
    {/*                       icon */}
    {/*                       labelPosition="left" */}
    {/*                       onClick={this.setSubtitle} */}
    {/*                       disabled={!this.haveLock()} */}
    {/*                     > */}
    {/*                       <Icon name="closed captioning" /> */}
    {/*                     </Button> */}
    {/*                   } */}
    {/*                 /> */}
    {/*               )} */}
    {/*             <ComboBox */}
    {/*               setMedia={this.setMedia} */}
    {/*               currentMedia={this.state.currentMedia} */}
    {/*               getMediaDisplayName={this.getMediaDisplayName} */}
    {/*               streamPath={this.state.settings.streamPath} */}
    {/*               mediaPath={this.state.settings.mediaPath} */}
    {/*               disabled={!this.haveLock()} */}
    {/*             /> */}
    {/*             <Separator /> */}
    {/*             <div className="mobileStack" style={{ display: 'flex', }}> */}
    {/*               {false && ( */}
    {/*                 <SearchComponent */}
    {/*                   setMedia={this.setMedia} */}
    {/*                   type={'youtube'} */}
    {/*                   streamPath={this.state.settings.streamPath} */}
    {/*                   mediaPath={this.state.settings.mediaPath} */}
    {/*                   disabled={!this.haveLock()} */}
    {/*                 /> */}
    {/*               )} */}
    {/*               {Boolean(this.state.settings.mediaPath) && ( */}
    {/*                 <SearchComponent */}
    {/*                   setMedia={this.setMedia} */}
    {/*                   type={'media'} */}
    {/*                   streamPath={this.state.settings.streamPath} */}
    {/*                   mediaPath={this.state.settings.mediaPath} */}
    {/*                   disabled={!this.haveLock()} */}
    {/*                 /> */}
    {/*               )} */}
    {/*             </div> */}
    {/*             <Separator /> */}
    {/*             <div */}
    {/*               id="fullScreenContainer" */}
    {/*               className={ */}
    {/*                 this.state.fullScreen ? 'fullScreenContainer' : '' */}
    {/*               } */}
    {/*               style={{ flexGrow: 1 }} */}
    {/*             > */}
    {/*               <div id="playerContainer"> */}
    {/*                 {(this.state.loading || */}
    {/*                   !this.state.currentMedia || */}
    {/*                   this.state.nonPlayableMedia) && ( */}
    {/*                   <div */}
    {/*                     id="loader" */}
    {/*                     className="videoContent" */}
    {/*                     style={{ */}
    {/*                       display: 'flex', */}
    {/*                       alignItems: 'center', */}
    {/*                       justifyContent: 'center', */}
    {/*                     }} */}
    {/*                   > */}
    {/*                     {!this.state.loading && !this.state.currentMedia && ( */}
    {/*                       <Message */}
    {/*                         color="yellow" */}
    {/*                         icon="hand point up" */}
    {/*                         header="You're not watching anything!" */}
    {/*                         content="Pick something to watch above." */}
    {/*                       /> */}
    {/*                     )} */}
    {/*                     {!this.state.loading && */}
    {/*                       this.state.nonPlayableMedia && ( */}
    {/*                         <Message */}
    {/*                           color="red" */}
    {/*                           icon="frown" */}
    {/*                           header="It doesn't look like this is a media file!" */}
    {/*                           content="Maybe you meant to launch a VBrowser if you're trying to visit a web page?" */}
    {/*                         /> */}
    {/*                       )} */}
    {/*                   </div> */}
    {/*                 )} */}
    {/*                 <iframe */}
    {/*                   style={{ */}
    {/*                     display: */}
    {/*                       this.isYouTube() && !this.state.loading */}
    {/*                         ? 'block' */}
    {/*                         : 'none', */}
    {/*                   }} */}
    {/*                   title="YouTube" */}
    {/*                   id="leftYt" */}
    {/*                   className="videoContent" */}
    {/*                   allowFullScreen */}
    {/*                   frameBorder="0" */}
    {/*                   allow="autoplay" */}
    {/*                   src="https://www.youtube.com/embed/?enablejsapi=1&controls=0&rel=0" */}
    {/*                 /> */}
    {/*                 <video */}
    {/*                     style={{ */}
    {/*                       display: */}
    {/*                         this.isVideo() && !this.state.loading */}
    {/*                           ? 'block' */}
    {/*                           : 'none', */}
    {/*                       width: '100%', */}
    {/*                     }} */}
    {/*                     id="leftVideo" */}
    {/*                   ></video> */}
    {/*                 {this.state.fullScreen && this.state.currentMedia && ( */}
    {/*                   <div className="controlsContainer">{controls}</div> */}
    {/*                 )} */}
    {/*               </div> */}
    {/*               {this.state.fullScreen && ( */}
    {/*                 <div className="fullScreenChat">{rightBar}</div> */}
    {/*               )} */}
    {/*             </div> */}
    {/*             {this.state.currentMedia && controls} */}
    {/*             {Boolean(this.state.total) && ( */}
    {/*               <div> */}
    {/*                 <Progress */}
    {/*                   size="tiny" */}
    {/*                   color="green" */}
    {/*                   inverted */}
    {/*                   value={this.state.downloaded} */}
    {/*                   total={this.state.total} */}
    {/*                   // indicating */}
    {/*                   label={ */}
    {/*                     Math.min( */}
    {/*                       (this.state.downloaded / this.state.total) * 100, */}
    {/*                       100 */}
    {/*                     ).toFixed(2) + */}
    {/*                     '% - ' + */}
    {/*                     formatSpeed(this.state.speed) + */}
    {/*                     ' - ' + */}
    {/*                     this.state.connections + */}
    {/*                     ' connections' */}
    {/*                   } */}
    {/*                 ></Progress> */}
    {/*               </div> */}
    {/*             )} */}
    {/*           </div> */}
    {/*           <Button */}
    {/*             style={{ */}
    {/*               position: 'absolute', */}
    {/*               top: '50%', */}
    {/*               right: 'calc(0% - 18px)', */}
    {/*               zIndex: 900, */}
    {/*             }} */}
    {/*             circular */}
    {/*             size="mini" */}
    {/*             icon={this.state.showRightBar ? 'angle right' : 'angle left'} */}
    {/*             onClick={() => */}
    {/*               this.setState({ showRightBar: !this.state.showRightBar }) */}
    {/*             } */}
    {/*           /> */}
    {/*         </Grid.Column> */}
    {/*       </Grid.Row> */}
    {/*     </Grid> */}
    {/*   } */}
    {/* </React.Fragment> */}
    {/* <View> */}
    {/*   {rightBar} */}
    {/* </View> */}

    let drawerRef;
    let chatRef;
    const navigationView = () => (
      <View style={styles.drawer}>
        <View style={styles.column}>
          <View style={{width:'100%'}}>
            <Text style={{color: '#ddd'}}> {'Display name:'} </Text>
            <TextInput style={styles.input} placeholder={'woof'}
              placeholderTextColor={'#444'}
              onSubmitEditing={(e)=>{
                drawerRef.closeDrawer();
                this.updateName(null, {value: e.nativeEvent.text});
              }}
            ></TextInput>
          </View>
          <Button
            style={styles.button}
            color={'#444'}
            title={'Random Doggo :3'}
            onPress={()=>{ drawerRef.closeDrawer(); this.updatePicture()}}
          ></Button>
          <Text style={{color:'#ddd'}}>{this.state.participants.length + ' connected (?????????)'}</Text>
        </View>
      </View>
    );

    const aspectRatio = 16/9;
    return (
      <DrawerLayoutAndroid
        ref={ref => drawerRef = ref}
        style={styles.container}
        drawerBackgroundColor={'#111'}
        renderNavigationView={navigationView}
        drawerWidth={this.windowWidth * 0.8}
        keyboardDismissMode={'on-drag'}
      >
        <View
          style={styles.videoContainer}>
          <Video
            ref={ref => this.videoRef = ref}
            style={{height: this.windowWidth/aspectRatio, backgroundColor:'black'}}
            source={{
              uri: ''//'http://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
            }}
            resizeMode="cover"
            onPlaybackStatusUpdate={pbStatus => this.setState({ pbStatus })}
          />
          <Controls
            //key={this.state.controlsTimestamp}
            style={styles.controls}
            togglePlay={this.togglePlay}
            onSeek={this.onSeek}
            jumpToLeader={this.jumpToLeader}
            paused={this.isPaused()}
            currentTime={this.getCurrentTime()}
            duration={this.getDuration()}
            leaderTime={this.isHttp() ? this.getLeaderTime() : undefined}
          />
        </View>
        <Chat
          ref={ref => chatRef = ref}
          chat={this.state.chat}
          nameMap={this.state.nameMap}
          pictureMap={this.state.pictureMap}
          socket={this.socket}
          scrollTs={this.state.scrollTimestamp}
          setMedia={this.setMedia}
        />
      </DrawerLayoutAndroid>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  videoContainer: {
    backgroundColor: '#000',
  },
  controls: {
    position: 'absolute',
  },
  drawer: {
    width:'100%',
    height:'100%',
    top: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  column: {
    height: '50%',
    flex: 1,
    alignItems: 'flex-start',
    padding: 24,
    justifyContent: 'space-around',
  },
  button: {
    width:'60%',
  },
  input: {
    width: '90%',
    borderBottomWidth: 2,
    borderColor: '#444',
    padding: 4,
    paddingLeft: 8,
    paddingRight: 8,
    color: '#fff',
  },
});
