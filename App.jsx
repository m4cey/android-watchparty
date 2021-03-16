import React from 'react';
import { StyleSheet, View, StatusBar, ActivityIndicator } from 'react-native';
//import * as Font from 'expo-font';

import WatchParty from './src/components/WatchParty';

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isReady: false,
    };
  }

  async componentDidMount() {
    // await Font.loadAsync({
    // });
    this.setState({ isReady: true });
  }


  render() {
    if (!this.state.isReady) {
      return <ActivityIndicator size="large" />;
    }

    return (
      <View style={{flex: 1}}>
        <StatusBar
          backgroundColor="#111"
          barStyle='light-content'/>
        <WatchParty/>
      </View>
    );
  }
}
