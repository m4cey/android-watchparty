import React from 'react';
import { TextInput, StyleSheet, KeyboardAvoidingView, FlatList, View, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { Container, Text, List, ListItem, Left, Right, Body, Thumbnail, Input, Item } from 'native-base';

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
  public state = { chatMsg: '' };

  updateChatMsg = (value) => {
    // console.log(e.target.selectionStart);
    this.setState({ chatMsg: value });
  };

  sendChatMsg = () => {
    if (!this.state.chatMsg) {
      return;
    }
    this.setState({ chatMsg: '' });
    this.props.socket.emit('CMD:chat', this.state.chatMsg);
  };

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
            keyExtractor={msg => msg.timestamp + msg.id}
            ListEmptyComponent={(<Text>{'no messages found'}</Text>)}
            renderItem={(msg) =>(
              <ChatMessage
                key={msg.item.timestamp + msg.item.id}
                message={msg}
                pictureMap={this.props.pictureMap}
                nameMap={this.props.nameMap}
                formatMessage={this.formatMessage}
              />
            )}
          />
          <TextInput
            ref={ref => this.textInput = ref}
            returnKeyType='send'
            style={styles.textInput}
            placeholder="url/chat:"
            onSubmitEditing={(e)=>{
              this.textInput.clear();
              this.props.socket.emit('CMD:chat', e.nativeEvent.text);
              //this.sendChatMsg()
            }}
            //onChangeText={this.updateChatMsg}
            //value={this.state.chatMsg}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }
}

const ChatMessage = ({
  message,
  nameMap,
  pictureMap,
  formatMessage,
}: {
  message: ChatMessage;
  nameMap: StringDict;
  pictureMap: StringDict;
  formatMessage: (cmd: string, msg: string) => View;
}) => {
  const { id, timestamp, cmd, msg, system } = message.item;
  return (
    <ListItem style={{borderColor:'#fff'}}>
      <Left>
        <Thumbnail circle small
          source={{uri: pictureMap[id]}}/>
        <Body style={{padding:0}}>
          <Text note>
            {Boolean(system) && 'System'}
            {nameMap[id] || id}
          </Text>
          <Text style={{fontSize: 12}}>
            {!cmd && msg}
            {cmd && formatMessage(cmd, msg)}
          </Text>
        </Body>
      </Left>
      <Right>
        <Text note>{new Date(timestamp).toLocaleTimeString()}</Text>
      </Right>
    </ListItem>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    //padding: 0,
    flex: 1,
    justifyContent: "flex-end"
  },
  textInput: {
    height: 40,
    width: '100%',
    fontSize: 14,
    //flex:1,
  },
  list: {
    //flexGrow: 1
  },
});
