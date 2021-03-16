import React from 'react';
import { Image, TextInput, StyleSheet, KeyboardAvoidingView, FlatList, View, ActivityIndicator, Text } from 'react-native';

import {
  formatTimestamp,
} from '../../utils';

interface ChatProps {
  chat: ChatMessage[];
  nameMap: StringDict;
  pictureMap: StringDict;
  socket: SocketIOClient.Socket;
  scrollTs: number;
  setMedia: Function;
}

export class Chat extends React.Component<ChatProps> {

  constructor(props){
    super(props);

    this.viewabilityConfig = {
      waitForInteraction: false,
      viewAreaCoveragePercentThreshold: 10,
    }
  }

  formatMessage = (cmd: string, msg: string): React.ReactNode | string => {
    if (cmd === 'host') {
      return (
        <View>
          <Text style={{color:'#ddd'}}>
          {`changed the video`}
          </Text>
        </View>
      );
    } else if (cmd === 'seek') {
      return `jumped to ${formatTimestamp(msg)}`;
    } else if (cmd === 'play') {
      return `started the video at ${formatTimestamp(msg)}`;
    } else if (cmd === 'pause') {
      return `paused the video at ${formatTimestamp(msg)}`;
    } else if (cmd === 'lock') {
      return `locked the room`;
    } else if (cmd === 'unlock') {
      return 'unlocked the room';
    }
    return cmd;
  };

  shouldComponentUpdate(nprops){
    return this.props.scrollTs != nprops.scrollTs;
  };

  render() {
    const renderItem = ({item : msg}) =>{
      return(
        <ChatMessage
          key={msg.timestamp + msg.id}
          message={msg}
          picture={this.props.pictureMap[msg.id]}
          name={this.props.nameMap[msg.id]}
          formatMessage={this.formatMessage}
        />);
    };

    const keyExtractor = (msg) => {return (msg.timestamp + msg.id + Math.random())};

    const onViewableItemsChanged = (info) => {console.log(info)};

    console.log("RENDER");
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior='height'
        keyboardVerticalOffset={-999}
      >
        <View style={styles.inner}>
          <FlatList
            ref={ref => this.flatList = ref}
            onContentSizeChange={() => this.flatList.scrollToEnd()}
            onLayout={() => this.flatList.scrollToEnd()}
            style={styles.list}
            data={this.props.chat}
            keyExtractor={keyExtractor}
            ListEmptyComponent={(
              <View style={{flex:1, flexDirection:'row', justifyContent:'center', padding: 20}}>
                <Text style={{color:'#888', fontSize: 16}}>{'it\'s just us here.. <w<'}</Text>
              </View>
            )}
            renderItem={renderItem}
            //viewabilityConfig={this.props.viewabilityConfig}
            //onViewableItemsChanged={onViewableItemsChanged}
            extraData={this.props.scrollTs}
          />
          <TextInput
            ref={ref => this.textInput = ref}
            returnKeyType='send'
            underlineColorAndroid={'#ddd'}
            style={styles.textInput}
            placeholder="url/chat:"
            placeholderTextColor={'#ddd'}
            onSubmitEditing={(e)=>{
              const value = e.nativeEvent.text;
              if (value.startsWith('http'))
                this.props.setMedia(null, value);
              else
                this.props.socket.emit('CMD:chat', value);
              this.textInput.clear();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }
}

class ChatMessage extends React.Component {

  constructor(props) {
    super(props);
  }
  shouldComponentUpdate(nprops) {
    return 0;
    const id = this.props.message.item.id;
    return (this.props.picture != nprops.picture);
  }
  render() {
    const { id, timestamp, cmd, msg, system } = this.props.message;
    return (
      <View style={styles.card}>
        <Image style={styles.image}
          source={{uri: this.props.picture}}/>
        <View style={styles.content}>
        <Text style={styles.head}>
          <Text style={{fontWeight:'normal',fontSize:12, textAlign: 'right', color: '#ddd' }}>
            {'('}
            {new Date(timestamp).toLocaleTimeString()}
            {')    '}
          </Text>
          <Text style={{fontStyle:'italic'}}>
            {Boolean(system) && 'System'}
            {this.props.name || id}
          </Text>
        </Text>
          <Text style={styles.message}>
            {!cmd && msg}
            <Text style={{color:'#ccc'}}>
              {cmd && this.props.formatMessage(cmd, msg)}
            </Text>
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  inner: {
    flex: 1
  },
  textInput: {
    height: 40,
    width: '100%',
    fontSize: 14,
    paddingLeft: 10,
    color: '#fff',
    //backgroundColor: '#0f0f0f',
  },
  list: {
  },
  card: {
    margin: 2,
    display: 'flex',
    flexDirection: 'row',
  },
  image: {
    width: 40,
    height: 40,
    margin: 2,
    borderRadius: 20,
  },
  content: {
    flex:1,
    paddingLeft: 4,
  },
  head: {
    paddingTop: 0,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  message: {
    fontSize: 14,
    color: '#fff',
  }
});
