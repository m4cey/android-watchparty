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
  scrollTimestamp: number;
  className?: string;
  //getMediaDisplayName: Function;
}

export class Chat extends React.Component<ChatProps> {

  formatMessage = (cmd: string, msg: string): React.ReactNode | string => {
    if (cmd === 'host') {
      return (
        <View>
          <Text>
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

  render() {
    //console.log(this.props.chat);
    const renderItem = (msg) =>{
      return(
        <ChatMessage
          key={msg.item.timestamp + msg.item.id}
          message={msg}
          pictureMap={this.props.pictureMap}
          nameMap={this.props.nameMap}
          formatMessage={this.formatMessage}
        />);
    };

    const keyExtractor = (msg) => {return (msg.timestamp + msg.id)};

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
            ListEmptyComponent={(<Text>No messages..</Text>)}
            renderItem={renderItem}
          />
          <TextInput
            ref={ref => this.textInput = ref}
            returnKeyType='send'
            style={styles.textInput}
            placeholder="url/chat:"
            onSubmitEditing={(e)=>{
              this.textInput.clear();
              this.props.socket.emit('CMD:chat', e.nativeEvent.text);
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
    const id = this.props.message.item.id;
    return !(this.props.pictureMap[id] == nprops.pictureMap[id])
  }
  render() {
    const { id, timestamp, cmd, msg, system } = this.props.message.item;
    return (
      <View style={styles.card}>
        <Image style={styles.image}
          source={{uri: this.props.pictureMap[id]}}/>
        <View style={styles.content}>
        <Text style={styles.head}>
          <Text style={{fontWeight:'normal',fontSize:12, textAlign: 'right'}}>
            {'('}
            {new Date(timestamp).toLocaleTimeString()}
            {')    '}
          </Text>
          <Text style={{fontStyle:'italic'}}>
            {Boolean(system) && 'System'}
            {this.props.nameMap[id] || id}
          </Text>
        </Text>
        <Text style={styles.message}>
          {!cmd && msg}
          {cmd && formatMessage(cmd, msg)}
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
    borderTopWidth: 1,
    paddingLeft: 10,
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
  },
  message: {
    fontSize: 14,
  }
});
