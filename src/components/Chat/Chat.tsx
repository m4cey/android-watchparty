import React from 'react';
//import { Button, Comment, Icon, Input } from 'semantic-ui-react';
import { View, Button, Thumbnail, List, ListItem, Left, Right, Body, Icon, Input } from 'native-base';

import {
  formatTimestamp,
  getColorForStringHex,
  getDefaultPicture,
} from '../../utils';
import { Separator } from '../App/App';

interface ChatProps {
  chat: ChatMessage[];
  nameMap: StringDict;
  pictureMap: StringDict;
  socket: SocketIOClient.Socket;
  scrollTimestamp: number;
  className?: string;
  getMediaDisplayName: Function;
  hide?: boolean;
  isChatDisabled?: boolean;
}

export class Chat extends React.Component<ChatProps> {
  public state = { chatMsg: '', isNearBottom: true };
  messagesRef = React.createRef<View>();

  componentDidMount() {
    this.scrollToBottom();
    this.messagesRef.current?.addEventListener('scroll', this.onScroll);
  }

  componentDidUpdate(prevProps: ChatProps) {
    if (this.props.scrollTimestamp !== prevProps.scrollTimestamp) {
      if (prevProps.scrollTimestamp === 0 || this.state.isNearBottom) {
        this.scrollToBottom();
      }
    }
    if (this.props.hide !== prevProps.hide) {
      this.scrollToBottom();
    }
  }

  updateChatMsg = (_e: any, data: { value: string }) => {
    // console.log(e.target.selectionStart);
    this.setState({ chatMsg: data.value });
  };

  sendChatMsg = () => {
    if (!this.state.chatMsg) {
      return;
    }
    if (this.chatTooLong()) {
      return;
    }
    this.setState({ chatMsg: '' });
    this.props.socket.emit('CMD:chat', this.state.chatMsg);
  };

  chatTooLong = () => {
    return Boolean(this.state.chatMsg?.length > 10000);
  };

  onScroll = () => {
    this.setState({ isNearBottom: this.isChatNearBottom() });
  };

  isChatNearBottom = () => {
    return (
      this.messagesRef.current &&
      this.messagesRef.current.scrollHeight -
        this.messagesRef.current.scrollTop -
        this.messagesRef.current.offsetHeight <
        100
    );
  };

  scrollToBottom = () => {
    if (this.messagesRef.current) {
      this.messagesRef.current.scrollTop = this.messagesRef.current.scrollHeight;
    }
  };

  formatMessage = (cmd: string, msg: string): React.ReactNode | string => {
    if (cmd === 'host') {
      return (
        <View>
          {`changed the video to `}
          <View style={{ textTransform: 'initial' }}>
            {this.props.getMediaDisplayName(msg)}
          </View>
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
    return (
      <View
        className={this.props.className}
        style={{
          display: this.props.hide ? 'none' : 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          minHeight: 0,
          marginTop: 0,
          marginBottom: 0,
          padding: '8px',
        }}
      >
        <View
          //className="chatContainer"
          ref={this.messagesRef}
          style={{ position: 'relative', flexGrow: 1, overFlow: 'auto'}}
        >
          <List>
            {this.props.chat.map((msg) => (
              <ChatMessage
                key={msg.timestamp + msg.id}
                message={msg}
                pictureMap={this.props.pictureMap}
                nameMap={this.props.nameMap}
                formatMessage={this.formatMessage}
              />
            ))}
          </List>
        </View>
        {/* <Separator /> */}
        <Input
          inverted
          fluid
          onKeyPress={(e: any) => e.key === 'Enter' && this.sendChatMsg()}
          onChange={this.updateChatMsg}
          value={this.state.chatMsg}
          error={this.chatTooLong()}
          icon
          disabled={this.props.isChatDisabled}
          placeholder={
            this.props.isChatDisabled
              ? 'The chat was disabled by the room owner.'
              : 'Enter a message...'
          }
        >
          <input />
          <Icon onClick={this.sendChatMsg} name="send" inverted circular link />
        </Input>
      </View>
    );
  }
}

export const ChatMessage = ({
  message,
  nameMap,
  pictureMap,
  formatMessage,
}: {
  message: ChatMessage;
  nameMap: StringDict;
  pictureMap: StringDict;
  formatMessage: (cmd: string, msg: string) => React.ReactNode;
}) => {
  const { id, timestamp, cmd, msg, system } = message;
  return (
    <ListItem comment>
      <Left>
        {id ? (
          <Thumbnail square small
            source={{uri:
              pictureMap[id] ||
              getDefaultPicture(nameMap[id], getColorForStringHex(id))
            }}/> ) : null}
      </Left>
      <Body>
        <Text note>
          {Boolean(system) && 'System'}
          {nameMap[id] || id}
        </Text>
        <Text style={{fontSize: 10, textTransform:'uppercase',letterSpacing:1}}>
          {cmd && formatMessage(cmd, msg)}
        </Text>
        <Text style={{}}>
          {!cmd && msg}
        </Text>
      </Body>
      <Right>
        <Text note>{new Date(timestamp).toLocaleTimeString()}</Text>
      </Right>
    </ListItem>
  );
};
