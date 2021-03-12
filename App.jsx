import React from 'react';
import { TextInput, StyleSheet, KeyboardAvoidingView, FlatList, View, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { Container, Text, List, ListItem, Left, Right, Body, Thumbnail, Input, Item } from 'native-base';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
//import { ChatMessage } from './src/components/Chat';

//import WatchParty from './src/components/App';

var data = [
  {msg:'hail satan !!', name:'nobody'},
  {msg:'HAIL SATAN !!!!', name:'dog'},
  {msg:'why are we still here..', name:'shephard'},
  {msg:'jUsT tO sUfFeR', name:'god'},
];

function newMessage(text) {
  if (text)
    data.push({msg: text, name: 'user'});
  console.log('->' + text);
}

export default class App extends React.Component {
  // public state = {
  //   user: undefined,
  // };

  constructor(props) {
    super(props);
    this.state = {
      isReady: false,
  //  user: undefined,
    };
  }

  async componentDidMount() {
    await Font.loadAsync({
      Roboto: require('native-base/Fonts/Roboto.ttf'),
      Roboto_medium: require('native-base/Fonts/Roboto_medium.ttf'),
      ...Ionicons.font,
    });
    this.setState({ isReady: true });
  }


  render() {
    if (!this.state.isReady) {
      return <ActivityIndicator size="large" />;
    }

    return (
      <Container>
        <StatusBar
          backgroundColor="#af0faa"
          barStyle='light-content'/>
        <View style={styles.video}></View>
        <KeyboardAvoidingView style={styles.container} behavior='height' keyboardVerticalOffset={-999}>
          <View style={styles.inner}>
            <FlatList
              ref={ref => this.flatList = ref}
              onContentSizeChange={() => this.flatList.scrollToEnd()}
              onLayout={() => this.flatList.scrollToEnd()}
              style={styles.list}
              data={data}
              keyExtractor={item => data.indexOf(item)+''}
              renderItem={({item}) => (
                <ChatMessage
                  msg={item.msg}
                  name={item.name}
                  date={data.indexOf(item)+'/'+data.length}
                />
              )}
            />
              <TextInput
                ref={ref => this.textInput = ref}
                style={styles.textInput}
                placeholder="url/chat:"
                onSubmitEditing={(e)=>{this.textInput.clear(); newMessage(e.nativeEvent.text)}}
              />
          </View>
        </KeyboardAvoidingView>
      </Container>
    );
  }
}

class ChatMessage extends React.Component {

  constructor(props) {
    super(props);
  }
  render(){
    return(
      <ListItem style={{borderColor:'#fff'}}>
        <Left>
          <Thumbnail circle small
            source={{uri: 'https://placedog.net/256/256?id='+this.props.name}}/>
          <Body style={{padding:0}}>
            <Text note>
              {this.props.name}
            </Text>
            <Text style={{fontSize: 12}}>
              {this.props.msg}
            </Text>
          </Body>
        </Left>
        <Right>
          <Text note>{this.props.date}</Text>
        </Right>
      </ListItem>
    );
  }
}

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
  video: {
    height: 200,
    backgroundColor: '#123',
  }
});
