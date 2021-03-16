import React from 'react';
import { Dimensions, StyleSheet, View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons as Icon } from '@expo/vector-icons';
import { formatTimestamp } from '../../utils';

interface ControlsProps {
  duration: number;
  togglePlay: Function;
  onSeek: Function;
  jumpToLeader: Function;
  paused: boolean;
  currentTime: number;
  leaderTime?: number;
}

const ww = Dimensions.get('window').width;
const wh = Dimensions.get('window').height;
const iconSize = ww/10;

// TODO a lot of this state is currently tied to the per-second tsMap update, which is leading to some UI lag
// e.g. cc, mute, timestamp
// play/pause seems to work better since it triggers a server emit
// Should probably have local state tracking CC/mute/time etc.
export class Controls extends React.Component<ControlsProps> {
  state = {
  };


  render() {
    const {
      togglePlay,
      onSeek,
      jumpToLeader,
      paused,
      currentTime,
      duration,
      leaderTime,
    } = this.props;
    const isBehind = leaderTime && leaderTime - currentTime > 5;
    return (
      <View
        style={styles.container}
        //backgroundColor='rgba(1,1,1,0.4)'
      >
        <Icon.Button
          size={iconSize}
          iconStyle={styles.icon}
          style={styles.iconButton}
          backgroundColor='rgba(1,1,1,0)'
          underlayColor='rgba(1,1,1,0)'
          onPress={togglePlay}
          name={paused ? 'play-circle' : 'pause-circle'}
        />
        <Icon.Button
          size={iconSize}
          iconStyle={styles.icon}
          style={styles.iconButton}
          backgroundColor='rgba(1,1,1,0)'
          underlayColor='rgba(1,1,1,0)'
          onPress={jumpToLeader}
          name={'sync-circle'}
        />
        <View style={{justifyContent: 'space-around'}}>
          <View style={{flexDirection: 'row', width: (ww-iconSize*2 - 8), justifyContent: 'space-between'}}>
            <Text style={styles.timestamp}>{formatTimestamp(currentTime)}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(duration)}</Text>
          </View>
          <Slider
            style={styles.slider}
            onSlidingComplete={onSeek}
            value={currentTime ? currentTime : 0}
            maximumValue={duration ? duration : 1}
          >
          </Slider>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: iconSize,
    width: '100%',
    position: 'relative',
    //top: -iconSize,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  icon: {
    marginRight: 0,
    paddingRight: 0,
  },
  iconButton: {
    padding: 0,
    margin: 0,
    marginLeft: 2,
    width: iconSize,
    height: iconSize,
  },
  timestamp: {
    color: '#fff',
    marginLeft: 8,
  },
  slider: {
    width: ww - (iconSize * 2 - 8),
    left: -8,
  },
});
